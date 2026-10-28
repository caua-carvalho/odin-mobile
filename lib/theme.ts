/**
 * ODIN V2 — visual tokens for React Native.
 *
 * Mirrors the web Tailwind palette so both clients read as the same system:
 * black glass surfaces, technical graphite borders, holographic orange as the
 * dominant identity and cyan as the secondary instrument accent.
 */

export const colors = {
  bg: '#050608',
  surface: '#0A0D12',
  elevated: '#10151E',
  raised: '#151C26',

  border: '#1A212B',
  borderBright: '#2A3340',

  text: '#F1F4F7',
  textSoft: '#C4CCD4',
  muted: '#8E98A5',
  dim: '#647080',
  faint: '#424C59',

  primary: '#FF6A00',
  primaryLight: '#FF9A3D',
  primaryDark: '#E65500',

  cyan: '#67DFFF',
  cyanDeep: '#00B8EB',

  success: '#10B981',
  successLight: '#34D399',

  warning: '#F59E0B',
  warningLight: '#FBBF24',

  danger: '#EF4444',
  dangerLight: '#F87171',

  white: '#FFFFFF',
} as const

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  black: 'Inter_800ExtraBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
} as const

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  huge: 44,
} as const

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 26,
  pill: 999,
} as const

export const glow = {
  orange: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.38,
    shadowRadius: 18,
    elevation: 8,
  },
  cyan: {
    shadowColor: colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
} as const

export const statusTone = {
  idle: { color: colors.muted, label: 'Em prontidão' },
  connecting: { color: colors.cyan, label: 'Conectando' },
  listening: { color: colors.cyan, label: 'Escutando' },
  thinking: { color: colors.primary, label: 'Processando' },
  speaking: { color: colors.primaryLight, label: 'Respondendo' },
  error: { color: colors.danger, label: 'Falha' },
  disabled: { color: colors.faint, label: 'Indisponível' },
} as const

export type OrbState = keyof typeof statusTone

/** Convert `#RRGGBB` to `rgba()` with the given opacity. */
export function alpha(hex: string, opacity: number): string {
  const normalized = hex.replace('#', '')
  const value = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized
  const int = Number.parseInt(value, 16)
  if (Number.isNaN(int)) return `rgba(255, 255, 255, ${opacity})`
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/** Mix two `#RRGGBB` colors. `t` = 0 returns `a`, `t` = 1 returns `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const int = Number.parseInt(hex.replace('#', ''), 16)
    return [(int >> 16) & 255, (int >> 8) & 255, int & 255]
  }
  const [ar, ag, ab] = parse(a)
  const [br, bg, bb] = parse(b)
  const clamp = Math.max(0, Math.min(1, t))
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0')
  return `#${toHex(ar + (br - ar) * clamp)}${toHex(ag + (bg - ag) * clamp)}${toHex(ab + (bb - ab) * clamp)}`
}

export const hudShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 14 },
  shadowOpacity: 0.55,
  shadowRadius: 24,
  elevation: 12,
} as const
