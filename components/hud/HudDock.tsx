import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { BlurView } from 'expo-blur'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import Animated, { FadeIn } from 'react-native-reanimated'
import type { BottomTabBarProps } from 'expo-router/js-tabs'
import { useOdinStatus } from '../../contexts/OdinStatusContext'
import { alpha, colors, fonts, radius } from '../../lib/theme'

interface TabMeta {
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  activeIcon: React.ComponentProps<typeof Ionicons>['name']
}

const META: Record<string, TabMeta> = {
  index: { label: 'Nexus', icon: 'planet-outline', activeIcon: 'planet' },
  chat: { label: 'Chat', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  knowledge: { label: 'Biblioteca', icon: 'library-outline', activeIcon: 'library' },
  activity: { label: 'Atividade', icon: 'pulse-outline', activeIcon: 'pulse' },
  system: { label: 'Telemetria', icon: 'hardware-chip-outline', activeIcon: 'hardware-chip' },
}

/**
 * Floating glass HUD dock. It replaces the default tab bar and mirrors the
 * web `FloatingDock` while staying thumb-friendly on mobile.
 */
export function HudDock({ state, descriptors, navigateToTab, insets }: BottomTabBarProps) {
  const { pendingApprovals } = useOdinStatus()
  const pendingCount = pendingApprovals.length

  return (
    <View
      pointerEvents="box-none"
      style={[styles.positioner, { paddingBottom: Math.max(insets.bottom, 10) }]}
    >
      <View style={styles.shell}>
        <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={styles.shellWash} />
        <View pointerEvents="none" style={styles.topHairline} />

        {state.routes.map((route, index) => {
          const meta = META[route.name] ?? {
            label: descriptors[route.key]?.options?.title ?? route.name,
            icon: 'ellipse-outline' as const,
            activeIcon: 'ellipse' as const,
          }
          const focused = state.index === index
          const showBadge = route.name === 'activity' && pendingCount > 0

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              android_ripple={{ color: alpha(colors.primary, 0.1), borderless: false }}
              onPress={() => {
                void Haptics.selectionAsync().catch(() => undefined)
                navigateToTab(route.key)
              }}
              style={({ pressed }) => [
                styles.tab,
                pressed && styles.tabPressed,
              ]}
            >
              {focused ? (
                <Animated.View
                  entering={FadeIn.duration(180)}
                  pointerEvents="none"
                  style={styles.activePill}
                />
              ) : null}

              {focused ? <View pointerEvents="none" style={styles.activeTick} /> : null}

              <View style={styles.iconWrap}>
                <Ionicons
                  name={focused ? meta.activeIcon : meta.icon}
                  size={20}
                  color={focused ? colors.primaryLight : colors.dim}
                />
                {showBadge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                numberOfLines={1}
                style={[styles.label, focused && styles.labelActive]}
              >
                {meta.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  positioner: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  shell: {
    width: '100%',
    maxWidth: 560,
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.95),
    backgroundColor: 'rgba(10, 13, 18, 0.88)',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 18,
  },
  shellWash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(10, 13, 18, 0.42)',
  },
  topHairline: {
    position: 'absolute',
    top: 0,
    left: 18,
    right: 18,
    height: StyleSheet.hairlineWidth,
    backgroundColor: alpha(colors.white, 0.14),
  },
  tab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 4,
    overflow: 'hidden',
  },
  tabPressed: {
    opacity: 0.82,
  },
  activePill: {
    position: 'absolute',
    top: 7,
    bottom: 7,
    left: 6,
    right: 6,
    borderRadius: radius.lg,
    backgroundColor: alpha(colors.primary, 0.1),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.22),
  },
  activeTick: {
    position: 'absolute',
    top: 0,
    width: 18,
    height: 2,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -9,
    minWidth: 14,
    height: 14,
    paddingHorizontal: 3,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warning,
    borderWidth: 1,
    borderColor: colors.bg,
  },
  badgeText: {
    fontFamily: fonts.monoBold,
    fontSize: 7,
    lineHeight: 9,
    color: colors.bg,
  },
  label: {
    fontFamily: fonts.monoMedium,
    fontSize: 8,
    letterSpacing: 0.4,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  labelActive: {
    color: colors.primaryLight,
  },
})
