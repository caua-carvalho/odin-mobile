import React, { type ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated'
import { alpha, colors, fonts, hudShadow, radius, spacing } from '../../lib/theme'

// -----------------------------------------------------------------------------
// PressableScale
// -----------------------------------------------------------------------------

interface PressableScaleProps {
  children: ReactNode
  onPress?: () => void
  onLongPress?: () => void
  disabled?: boolean
  style?: StyleProp<ViewStyle>
  scaleTo?: number
  haptic?: 'selection' | 'light' | 'medium' | 'none'
  accessibilityLabel?: string
  accessibilityRole?: 'button' | 'link' | 'tab'
  hitSlop?: number
}

export function PressableScale({
  children,
  onPress,
  onLongPress,
  disabled = false,
  style,
  scaleTo = 0.96,
  haptic = 'selection',
  accessibilityLabel,
  accessibilityRole = 'button',
  hitSlop,
}: PressableScaleProps) {
  const scale = useSharedValue(1)
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const fireHaptic = () => {
    if (haptic === 'none') return
    const promise = haptic === 'light'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : haptic === 'medium'
        ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
        : Haptics.selectionAsync()
    void promise.catch(() => undefined)
  }

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        disabled={disabled}
        hitSlop={hitSlop}
        onPressIn={() => {
          // Reanimated shared values are mutable by design.
          // eslint-disable-next-line react-hooks/immutability
          if (!disabled) scale.value = withSpring(scaleTo, { damping: 18, stiffness: 320 })
        }}
        onPressOut={() => {
          // eslint-disable-next-line react-hooks/immutability
          scale.value = withSpring(1, { damping: 16, stiffness: 260 })
        }}
        onPress={disabled ? undefined : () => {
          fireHaptic()
          onPress?.()
        }}
        onLongPress={disabled ? undefined : () => {
          fireHaptic()
          onLongPress?.()
        }}
        style={({ pressed }) => [
          styles.pressable,
          disabled && { opacity: 0.42 },
          pressed && !disabled && { opacity: 0.88 },
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  )
}

// -----------------------------------------------------------------------------
// Panel
// -----------------------------------------------------------------------------

interface PanelProps {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  padded?: boolean
  glow?: 'orange' | 'cyan' | 'none'
}

export function Panel({ children, style, padded = true, glow = 'none' }: PanelProps) {
  return (
    <View
      style={[
        styles.panel,
        padded && styles.panelPadded,
        glow === 'orange' && styles.panelGlowOrange,
        glow === 'cyan' && styles.panelGlowCyan,
        style,
      ]}
    >
      <View pointerEvents="none" style={styles.panelTopLine} />
      {children}
    </View>
  )
}

// -----------------------------------------------------------------------------
// Badge
// -----------------------------------------------------------------------------

export type BadgeTone = 'primary' | 'cyan' | 'success' | 'warning' | 'danger' | 'neutral'

const BADGE_TONES: Record<BadgeTone, { color: string; background: string; border: string }> = {
  primary: {
    color: colors.primaryLight,
    background: alpha(colors.primary, 0.14),
    border: alpha(colors.primary, 0.32),
  },
  cyan: {
    color: colors.cyan,
    background: alpha(colors.cyan, 0.12),
    border: alpha(colors.cyan, 0.3),
  },
  success: {
    color: colors.successLight,
    background: alpha(colors.success, 0.14),
    border: alpha(colors.success, 0.3),
  },
  warning: {
    color: colors.warningLight,
    background: alpha(colors.warning, 0.14),
    border: alpha(colors.warning, 0.3),
  },
  danger: {
    color: colors.dangerLight,
    background: alpha(colors.danger, 0.14),
    border: alpha(colors.danger, 0.3),
  },
  neutral: {
    color: colors.muted,
    background: alpha(colors.elevated, 0.8),
    border: colors.border,
  },
}

interface BadgeProps {
  label: string
  tone?: BadgeTone
  icon?: React.ComponentProps<typeof Ionicons>['name']
  dot?: boolean
  style?: StyleProp<ViewStyle>
}

export function Badge({ label, tone = 'neutral', icon, dot = false, style }: BadgeProps) {
  const palette = BADGE_TONES[tone]
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: palette.background, borderColor: palette.border },
        style,
      ]}
    >
      {dot ? <View style={[styles.badgeDot, { backgroundColor: palette.color }]} /> : null}
      {icon ? <Ionicons name={icon} size={11} color={palette.color} /> : null}
      <Text style={[styles.badgeText, { color: palette.color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  )
}

// -----------------------------------------------------------------------------
// HudButton
// -----------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'cyan' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, { background: string; border: string; text: string }> = {
  primary: {
    background: colors.primary,
    border: colors.primary,
    text: colors.white,
  },
  secondary: {
    background: alpha(colors.elevated, 0.9),
    border: colors.border,
    text: colors.text,
  },
  ghost: {
    background: 'transparent',
    border: 'transparent',
    text: colors.muted,
  },
  cyan: {
    background: alpha(colors.cyan, 0.12),
    border: alpha(colors.cyan, 0.34),
    text: colors.cyan,
  },
  danger: {
    background: alpha(colors.danger, 0.14),
    border: alpha(colors.danger, 0.34),
    text: colors.dangerLight,
  },
}

const BUTTON_SIZES: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number; gap: number }> = {
  sm: { paddingVertical: 7, paddingHorizontal: 11, fontSize: 11, gap: 5 },
  md: { paddingVertical: 11, paddingHorizontal: 16, fontSize: 13, gap: 7 },
  lg: { paddingVertical: 15, paddingHorizontal: 20, fontSize: 15, gap: 9 },
}

interface HudButtonProps {
  label: string
  onPress?: () => void
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: React.ComponentProps<typeof Ionicons>['name']
  iconRight?: React.ComponentProps<typeof Ionicons>['name']
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
  fullWidth?: boolean
}

export function HudButton({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  disabled = false,
  loading = false,
  style,
  fullWidth = false,
}: HudButtonProps) {
  const palette = BUTTON_VARIANTS[variant]
  const sizing = BUTTON_SIZES[size]
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={variant === 'primary' ? 'medium' : 'selection'}
      style={[
        fullWidth && { alignSelf: 'stretch' },
        variant === 'primary' && styles.primaryButton,
        style,
      ]}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.button,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
            paddingVertical: sizing.paddingVertical,
            paddingHorizontal: sizing.paddingHorizontal,
            gap: sizing.gap,
          },
        ]}
      >
        {loading ? (
          <Ionicons name="sync" size={sizing.fontSize + 3} color={palette.text} />
        ) : icon ? (
          <Ionicons name={icon} size={sizing.fontSize + 3} color={palette.text} />
        ) : null}
        <Text style={[styles.buttonText, { color: palette.text, fontSize: sizing.fontSize }]}>
          {label}
        </Text>
        {iconRight ? (
          <Ionicons name={iconRight} size={sizing.fontSize + 3} color={palette.text} />
        ) : null}
      </View>
    </PressableScale>
  )
}

// -----------------------------------------------------------------------------
// SectionLabel
// -----------------------------------------------------------------------------

export function SectionLabel({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionLabelRow}>
      <View style={styles.sectionLabelLeft}>
        <View style={styles.sectionTick} />
        <Text style={styles.sectionLabelText}>{title}</Text>
        <View style={styles.sectionLine} />
      </View>
      {right}
    </View>
  )
}

// -----------------------------------------------------------------------------
// StatTile
// -----------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  tone = 'neutral',
  style,
}: {
  label: string
  value: string | number
  tone?: BadgeTone
  style?: StyleProp<ViewStyle>
}) {
  const palette = BADGE_TONES[tone]
  return (
    <View style={[styles.statTile, style]}>
      <Text style={[styles.statValue, { color: palette.color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

// -----------------------------------------------------------------------------
// EmptyState
// -----------------------------------------------------------------------------

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name']
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconRing}>
        <Ionicons name={icon} size={30} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {action ? <View style={styles.emptyAction}>{action}</View> : null}
    </View>
  )
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  pressable: {
    alignSelf: 'flex-start',
  },
  panel: {
    backgroundColor: alpha(colors.surface, 0.92),
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.9),
    overflow: 'hidden',
    ...hudShadow,
  },
  panelPadded: {
    padding: spacing.md,
  },
  panelGlowOrange: {
    borderColor: alpha(colors.primary, 0.34),
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  panelGlowCyan: {
    borderColor: alpha(colors.cyan, 0.28),
    shadowColor: colors.cyan,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  panelTopLine: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.12),
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  primaryButton: {
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  buttonText: {
    fontFamily: fonts.semibold,
    letterSpacing: 0.2,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  sectionLabelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  sectionTick: {
    width: 3,
    height: 12,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  sectionLabelText: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  sectionLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: spacing.xs,
  },
  statTile: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.65),
    gap: 2,
  },
  statValue: {
    fontFamily: fonts.monoBold,
    fontSize: 18,
    letterSpacing: -0.4,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.7,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.3),
    backgroundColor: alpha(colors.primary, 0.08),
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: fonts.semibold,
    fontSize: 16,
    color: colors.text,
    marginBottom: 6,
    textAlign: 'center',
  },
  emptyDescription: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyAction: {
    marginTop: spacing.md,
  },
})
