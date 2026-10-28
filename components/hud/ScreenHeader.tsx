import React, { type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { colors, fonts, spacing } from '../../lib/theme'

interface ScreenHeaderProps {
  eyebrow: string
  title: string
  subtitle?: string
  right?: ReactNode
  compact?: boolean
}

export function ScreenHeader({ eyebrow, title, subtitle, right, compact = false }: ScreenHeaderProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(420).springify().damping(18)}
      style={[styles.row, compact && styles.rowCompact]}
    >
      <View style={styles.copy}>
        <View style={styles.eyebrowRow}>
          <View style={styles.eyebrowDot} />
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          <View style={styles.eyebrowLine} />
        </View>
        <Text accessibilityRole="header" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  rowCompact: {
    paddingBottom: spacing.md,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: 7,
  },
  eyebrowDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  eyebrow: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    letterSpacing: 2,
    color: colors.primaryLight,
    textTransform: 'uppercase',
  },
  eyebrowLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 27,
    letterSpacing: -0.9,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 4,
    maxWidth: 320,
  },
  right: {
    paddingTop: 4,
    alignItems: 'flex-end',
  },
})
