/**
 * React Native port of the frame maths behind `@yogesharc/thinking-orbs`
 * (MIT, https://github.com/yogesharc/thinking-orbs).
 *
 * The web package is DOM-only: `mountOrb` creates SVG elements and updates
 * their attributes every animation frame. This module keeps the same state
 * machine and geometry, but returns a set of SVG path strings instead, so the
 * UI thread can paint the orb with a handful of `react-native-svg` paths.
 */

const TAU = Math.PI * 2
const GOLDEN = Math.PI * (3 - Math.sqrt(5))

export const OPACITY_LAYERS = 16

export type ThinkingOrbLook =
  | 'idle'
  | 'idle-blink'
  | 'working'
  | 'working-gyro'
  | 'reasoning'
  | 'searching-lighthouse'
  | 'waiting'
  | 'compacting-squeeze'
  | 'retrying'
  | 'retrying-surge'

type Point = [number, number, number]

const PERIOD: Record<ThinkingOrbLook, number> = {
  idle: 6500,
  'idle-blink': 13000,
  working: 3000,
  'working-gyro': 3000,
  reasoning: 6500,
  'searching-lighthouse': 13000,
  waiting: 13000,
  'compacting-squeeze': 10000,
  retrying: 13000,
  'retrying-surge': 13000,
}

/** Shared by the reasoning walk. */
const HOP = 220
const TAIL = 5
const WALK = 16

/** Working's ring axis in view space. */
const RING_AXIS: Point = (() => {
  const tip = (30 * Math.PI) / 180
  const roll = (10 * Math.PI) / 180
  return [
    -Math.sin(roll) * Math.cos(tip),
    Math.cos(roll) * Math.cos(tip),
    Math.sin(tip),
  ]
})()

/** Gyro and Squeeze: the ends turn up to this far against the middle. */
const TWIST = 1.4

/** Lighthouse's beam lean and trail. */
const LEAN = (30 * Math.PI) / 180
const TRAIL = Math.PI / 2

/** Idle · Blink's beat. */
const BEAT = 2600

function ease(x: number): number {
  'worklet'
  return (1 - Math.cos(Math.PI * x)) / 2
}

function hash(n: number): number {
  'worklet'
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}

function dist2(a: Point, b: Point): number {
  'worklet'
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

function spring(x: number): number {
  'worklet'
  return 1 - Math.exp(-4.5 * x) * Math.cos(3 * Math.PI * x) - x * Math.exp(-4.5)
}

/** Retrying's spin: turn, brake, spring back, speed up again. */
function rewind(t: number, w: number): number {
  'worklet'
  const P = 3200
  const k = Math.floor(t / P)
  const u = t - k * P
  const back = 0.6 * 2100 * w
  const fwd = (2000 + 100 + 100) * w
  let a: number
  if (u < 2000) {
    a = u * w
  } else if (u < 2200) {
    const x = (u - 2000) / 200
    a = (2000 + 200 * (x - (x * x) / 2)) * w
  } else if (u < 3000) {
    a = 2100 * w - back * spring((u - 2200) / 800)
  } else {
    const x = (u - 3000) / 200
    a = 2100 * w - back + 100 * x * x * w
  }
  return k * (fwd - back) + a
}

function yawOf(look: ThinkingOrbLook, t: number): number {
  'worklet'
  if (look === 'retrying') return rewind(2 * t, TAU / 9000)
  if (look === 'retrying-surge') {
    const turns = t / 3250
    const u = turns - Math.floor(turns)
    return (Math.floor(turns) + (1 - (1 - u) ** 3)) * TAU
  }
  return (t / PERIOD[look]) * TAU
}

function blinkAt(t: number): number {
  'worklet'
  const u = t % BEAT
  if (u < 120) return 1.2 * (1 - ease(u / 120))
  if (u < 180) return 0
  if (u < 430) return 1.2 * ease((u - 180) / 250)
  return 1.2
}

/** A Fibonacci sphere, exactly the cloud the web package uses. */
export function buildPoints(count: number): Point[] {
  return Array.from({ length: count }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / count
    const r = Math.sqrt(1 - y * y)
    const th = i * GOLDEN
    return [r * Math.cos(th), y, r * Math.sin(th)]
  })
}

/** The k nearest points to `pts[i]`, nearest first. */
export function nearestPoints(pts: Point[], i: number, k: number): number[] {
  const idx: number[] = []
  const d: number[] = []
  const p = pts[i]
  for (let j = 0; j < pts.length; j++) {
    if (j === i) continue
    const e = dist2(p, pts[j])
    let at = idx.length
    if (at === k) {
      if (e >= d[k - 1]) continue
      at--
    }
    while (at > 0 && d[at - 1] > e) {
      idx[at] = idx[at - 1]
      d[at] = d[at - 1]
      at--
    }
    idx[at] = j
    d[at] = e
  }
  return idx
}

export function createWalkState(): WalkState {
  return { look: null, walks: [], hops: 0 }
}

export interface WalkState {
  look: ThinkingOrbLook | null
  walks: number[][]
  hops: number
}

function emit(
  paths: string[],
  x: number,
  y: number,
  r: number,
  a: number,
): void {
  'worklet'
  if (a <= 0.02) return
  let level = Math.floor(a * OPACITY_LAYERS)
  if (level >= OPACITY_LAYERS) level = OPACITY_LAYERS - 1
  if (level < 0) return
  const radius = r < 0.45 ? 0.45 : r
  const diameter = radius * 2
  const left = x - radius
  paths[level] +=
    `M${left.toFixed(1)} ${y.toFixed(1)}` +
    `a${radius.toFixed(1)} ${radius.toFixed(1)} 0 1 0 ${diameter.toFixed(1)} 0` +
    `a${radius.toFixed(1)} ${radius.toFixed(1)} 0 1 0 ${(-diameter).toFixed(1)} 0`
}

export interface OrbFrameInput {
  look: ThinkingOrbLook
  size: number
  points: Point[]
  near: number[][]
  tone: number
}

/**
 * Draws one frame of the orb and returns `OPACITY_LAYERS` path strings.
 * Runs as a worklet so the whole computation stays on the UI thread.
 */
export function buildOrbPaths(t: number, input: OrbFrameInput, walk: WalkState): string[] {
  'worklet'
  const { look, size, points, near, tone } = input
  const count = points.length
  const paths: string[] = new Array(OPACITY_LAYERS).fill('')
  if (count === 0 || size <= 0) return paths

  const center = size / 2
  const radius = center * 0.8
  const density = count / size
  const dotRadius = Math.pow(size / 64, 0.6) * 0.72 * Math.sqrt(4 / density)

  // The engine only has one walker in the mobile port; the web `twins`
  // variant is not part of the wrappers this app uses.
  if (walk.look !== look) {
    walk.look = look
    walk.walks = []
    walk.hops = 0
  }

  const period = PERIOD[look]
  const yaw = yawOf(look, t)
  const gyro = look === 'working-gyro' ? (t / 5000) * TAU : null
  const pitch =
    ((20 + (gyro === null ? 0 : 10 * Math.cos(gyro))) * Math.PI) / 180
  const roll = gyro === null ? 0 : ((12 * Math.sin(gyro)) * Math.PI) / 180
  const sr = Math.sin(roll)
  const cr = Math.cos(roll)
  const sy = Math.sin(yaw)
  const cy = Math.cos(yaw)
  const st = Math.sin(pitch)
  const ct = Math.cos(pitch)

  const facing = (k: number): number => {
    'worklet'
    const p = points[k]
    return p[1] * st + (-p[0] * sy + p[2] * cy) * ct
  }

  const reasoning = look === 'reasoning'

  let lit: number[] | null = null
  if (reasoning) {
    lit = new Array<number>(count).fill(0)
    const s = t / HOP
    const n = Math.floor(s)
    const f = s - n
    if (walk.walks.length === 0 || walk.walks[0].length === 0) {
      let first = 0
      for (let k = 1; k < count; k++) {
        if (facing(k) > facing(first)) first = k
      }
      walk.walks = [[first]]
    }
    walk.hops = Math.max(walk.hops, n - WALK)
    for (; walk.hops < n; walk.hops++) {
      const path = walk.walks[0]
      const from = path[path.length - 1]
      const neighbours = near[from] ?? []
      let best = -1
      let score = -Infinity
      const recentStart = Math.max(0, path.length - 8)
      for (let j = 0; j < neighbours.length; j++) {
        const k = neighbours[j]
        let recent = false
        for (let q = recentStart; q < path.length; q++) {
          if (path[q] === k) {
            recent = true
            break
          }
        }
        if (recent) continue
        const sc = facing(k) + 0.35 * hash(walk.hops * 31 + j)
        if (sc > score) {
          score = sc
          best = k
        }
      }
      path.push(best < 0 ? neighbours[0] : best)
      if (path.length > WALK) path.shift()
    }

    for (let j = TAIL - 1; j >= 0; j--) {
      const path = walk.walks[0]
      const k = path[path.length - 1 - j]
      if (k === undefined) continue
      const value = j === 0 ? ease(Math.min(1, f * 2)) : 1 - (j - 1 + f) / TAIL
      lit[k] = Math.max(lit[k], value)
    }
  }

  const squeeze = look === 'compacting-squeeze'
  const blink = look === 'idle-blink'
  const working = look === 'working'
  const waiting = look === 'waiting'
  const lighthouse = look === 'searching-lighthouse'

  const tw =
    look === 'working-gyro'
      ? 0.5 * Math.sin((t / 2600) * TAU)
      : squeeze
        ? Math.sin((t / 2600) * TAU)
        : 0

  const head = (t / 2000) * TAU + yaw
  const ahead = TAU / 2000 + TAU / period
  const glow = Math.min(1, 3 * Math.sin(Math.PI * ((t % 6000) / 6000)))

  for (let i = 0; i < count; i++) {
    const p = points[i]
    const x = p[0]
    const y = p[1]
    const z = p[2]

    const turn = yaw + TWIST * tw * y
    const ly = tw ? Math.sin(turn) : sy
    const lc = tw ? Math.cos(turn) : cy
    const z1 = -x * ly + z * lc

    let vx = x * lc + z * ly
    let vy = y * ct - z1 * st
    let vz = y * st + z1 * ct

    const d = (vz + 1) / 2
    let r = (0.5 + 1.4 * d) * dotRadius
    let a = Math.max(0, (d - 0.3) / 0.7)

    if (working) {
      const u = t % 1700
      const at = 1.3 - 2.6 * ease(Math.min(1, u / 1200))
      const q = vx * RING_AXIS[0] + vy * RING_AXIS[1] + vz * RING_AXIS[2]
      const g = u < 1200 ? Math.exp(-(((q - at) / 0.2) ** 2)) : 0
      r *= 1 + 0.6 * g
      a += (1 - a) * g
      const w =
        Math.min(1, Math.max(0, (q - at) / 0.2)) *
        (u < 1200 ? 1 : 1 - Math.min(1, 1.6 * ((u - 1200) / 800)))
      vx *= 1 - 0.08 * w
      vy *= 1 - 0.08 * w
      r *= 1 - 0.15 * w
    }

    if (lighthouse) {
      a *= 0.5
      const lr = Math.sin(LEAN)
      const lc2 = Math.cos(LEAN)
      const across = vx * lc2 - vy * lr
      const toward = -st * (vx * lr + vy * lc2) + ct * vz
      const off = Math.atan2(across, toward) - (((t / 2500) % 1) * TAU - Math.PI)
      const dphi = ((((off + Math.PI) % TAU) + TAU) % TAU) - Math.PI
      const beam =
        dphi < 0 ? Math.max(0, 1 + dphi / TRAIL) : Math.exp(-((dphi / 0.45) ** 2))
      const g = beam * (0.25 + 0.75 * Math.min(1, Math.max(0, (d - 0.4) / 0.3)))
      r *= 1 + 0.6 * g
      a += (1 - a) * g
    }

    if (reasoning && lit) {
      const spark = lit[i]
      a *= 0.5
      if (spark) {
        r *= 1 + 0.8 * spark
        a += (1 - a) * spark
      }
    }

    if (waiting) {
      const radiusAt = Math.hypot(x, y, z) || 1
      const lat = Math.asin(y / radiusAt)
      const lon = Math.atan2(z, x)
      const off = Math.atan2(Math.sin(lon - head), Math.cos(lon - head))
      const along = off * Math.cos(lat)
      const shifted = t + off / ahead
      const headLat =
        ((70 * Math.PI) / 180) * (1 - 2 * ((shifted % 6000) / 6000))
      const g =
        Math.exp(-(((lat - headLat) / 0.28) ** 2)) *
        Math.exp(-((along / (off * ahead > 0 ? 0.12 : 1)) ** 2))
      const w = glow * g ** 0.6
      a = a * 0.5 + (1 - a * 0.5) * w
      r *= 1 + 1.1 * w
    }

    if (blink) {
      const lids = blinkAt(t)
      const edge =
        Math.exp(-(((Math.abs(vy) - lids) / 0.06) ** 2)) *
        (lids < 1.2 ? 1 : 0)
      a *= Math.min(1, Math.max(0, (lids - Math.abs(vy)) / 0.08))
      r *= 1 + 0.4 * edge
      a +=
        (1 - a) *
        edge *
        Math.min(1, Math.max(0, (d - 0.4) / 0.3))
    }

    if (roll) {
      const rx = vx * cr - vy * sr
      const ry = vx * sr + vy * cr
      vx = rx
      vy = ry
    }

    emit(paths, center + vx * radius, center - vy * radius, r, a * tone)
  }

  return paths
}
