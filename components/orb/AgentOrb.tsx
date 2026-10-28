import React, { useCallback, useEffect, useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Path } from 'react-native-svg'
import Animated, {
  useAnimatedProps,
  useFrameCallback,
  useReducedMotion,
  useSharedValue,
  type FrameInfo,
  type SharedValue,
} from 'react-native-reanimated'
import { colors, type OrbState } from '../../lib/theme'
import {
  OPACITY_LAYERS,
  buildOrbPaths,
  buildPoints,
  createWalkState,
  nearestPoints,
  type OrbFrameInput,
  type ThinkingOrbLook,
  type WalkState,
} from './thinking-orb'

const AnimatedPath = Animated.createAnimatedComponent(Path)

const EMPTY_PATHS = Array.from({ length: OPACITY_LAYERS }, () => '')
const REACH = 24

export type AgentOrbState =
  | OrbState
  | 'searching'
  | 'working'
  | 'queued'
  | 'waiting_approval'
  | 'stopping'
  | 'completed'

interface OrbPreset {
  look: ThinkingOrbLook
  color: string
  tone: number
}

/**
 * Mirrors the web `AgentOrb` map: each core state gets a thinking-orb look,
 * a tint from the shared palette, and the same tone the web passes as a
 * `text-*` opacity class.
 */
const PRESETS: Record<AgentOrbState, OrbPreset> = {
  idle: { look: 'idle', color: colors.primary, tone: 0.8 },
  connecting: { look: 'working-gyro', color: colors.cyan, tone: 0.9 },
  listening: { look: 'searching-lighthouse', color: colors.cyan, tone: 1 },
  thinking: { look: 'reasoning', color: colors.primaryLight, tone: 1 },
  speaking: { look: 'working', color: colors.primaryLight, tone: 1 },
  error: { look: 'retrying-surge', color: colors.danger, tone: 1 },
  disabled: { look: 'idle', color: colors.faint, tone: 0.45 },

  searching: { look: 'searching-lighthouse', color: colors.cyan, tone: 1 },
  working: { look: 'working', color: colors.primary, tone: 1 },
  queued: { look: 'waiting', color: colors.muted, tone: 0.75 },
  waiting_approval: { look: 'waiting', color: colors.warning, tone: 1 },
  stopping: { look: 'compacting-squeeze', color: colors.warning, tone: 1 },
  completed: { look: 'idle-blink', color: colors.success, tone: 1 },
}

interface AgentOrbProps {
  state?: AgentOrbState
  size?: number
  label?: string
}

interface OrbPaths {
  paths: string[]
  key: string
}

interface OrbLayerProps {
  frame: SharedValue<OrbPaths>
  level: number
  color: string
}

function OrbLayer({ frame, level, color }: OrbLayerProps) {
  const animatedProps = useAnimatedProps(() => ({
    d: frame.value.paths[level],
  }))

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      fill={color}
      fillOpacity={(level + 0.5) / OPACITY_LAYERS}
    />
  )
}

/* eslint-disable react-hooks/immutability -- Reanimated shared values are mutable by design. */
/**
 * React Native counterpart of `apps/web/src/components/common/AgentOrb.tsx`.
 *
 * The web component renders `@yogesharc/thinking-orbs`, whose DOM/SVG loop
 * cannot run in React Native. This keeps its looks and motion, but paints the
 * dots on the UI thread as a small set of SVG paths. That lets the hero orb run
 * at 168–206px without mounting hundreds of React elements.
 */
export function AgentOrb({ state = 'idle', size = 200, label }: AgentOrbProps) {
  const preset = PRESETS[state] ?? PRESETS.idle
  const reduceMotion = useReducedMotion()

  const count = Math.max(56, Math.min(420, Math.round(size * 2.4)))
  const points = useMemo(() => buildPoints(count), [count])
  const near = useMemo(
    () =>
      preset.look === 'reasoning'
        ? points.map((_, index) => nearestPoints(points, index, REACH))
        : [],
    [points, preset.look],
  )

  const config = useSharedValue<OrbFrameInput>({
    look: preset.look,
    size,
    points,
    near,
    tone: preset.tone,
  })
  const walk = useSharedValue<WalkState>(createWalkState())
  const frame = useSharedValue<OrbPaths>({ paths: EMPTY_PATHS, key: '' })
  const clock = useSharedValue(0)
  const lastDraw = useSharedValue(0)

  const onFrame = useCallback(
    (info: FrameInfo) => {
      'worklet'
      const current = config.value
      const key = `${current.look}:${current.size}:${current.tone}`

      if (reduceMotion) {
        if (frame.value.key === key) return
        const staticWalk = walk.value
        const paths = buildOrbPaths(900, current, staticWalk)
        walk.value = staticWalk
        frame.value = { paths, key }
        return
      }

      const elapsed = Math.min(info.timeSincePreviousFrame ?? 16, 100)
      const now = clock.value + elapsed
      clock.value = now

      if (now - lastDraw.value < 32) return
      lastDraw.value = now

      const currentWalk = walk.value
      const paths = buildOrbPaths(now, current, currentWalk)
      walk.value = currentWalk
      frame.value = { paths, key: '' }
    },
    [clock, config, frame, lastDraw, reduceMotion, walk],
  )

  useEffect(() => {
    config.value = {
      look: preset.look,
      size,
      points,
      near,
      tone: preset.tone,
    }
    walk.value = createWalkState()
    clock.value = 0
    lastDraw.value = 0
    frame.value = { paths: EMPTY_PATHS, key: '' }
  }, [config, clock, frame, lastDraw, near, points, preset.look, preset.tone, size, walk])

  useFrameCallback(onFrame)

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label ?? `Núcleo ODIN — ${state}`}
      style={[styles.wrap, { width: size, height: size }]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {EMPTY_PATHS.map((_, level) => (
          <OrbLayer
            key={level}
            frame={frame}
            level={level}
            color={preset.color}
          />
        ))}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
