import React, { useEffect, useState } from 'react'
import {
  AccessibilityInfo,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import Svg, {
  Circle,
  Defs,
  Line,
  Pattern,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import { alpha, colors } from '../../lib/theme'

/**
 * Ambient HUD background: technical grid, two holographic glows and a slow
 * scanline. Static except for the scanline, so it is cheap enough for Expo Go.
 */
export function HudBackdrop() {
  const { width, height } = useWindowDimensions()
  const [reduceMotion, setReduceMotion] = useState(false)
  const scan = useSharedValue(0)

  useEffect(() => {
    let mounted = true
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value)
    })
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  useEffect(() => {
    if (reduceMotion) {
      scan.value = 0
      return
    }
    scan.value = withRepeat(
      withTiming(1, { duration: 16_000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [reduceMotion, scan])

  const scanStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scan.value * (height + 160) - 80 }],
  }))

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height}>
        <Defs>
          <Pattern id="odin-grid" width={32} height={32} patternUnits="userSpaceOnUse">
            <Line
              x1="0"
              y1="0"
              x2="32"
              y2="0"
              stroke={alpha(colors.primary, 0.055)}
              strokeWidth="1"
            />
            <Line
              x1="0"
              y1="0"
              x2="0"
              y2="32"
              stroke={alpha(colors.primary, 0.055)}
              strokeWidth="1"
            />
          </Pattern>
          <RadialGradient id="odin-orange-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.primary} stopOpacity="0.18" />
            <Stop offset="0.55" stopColor={colors.primary} stopOpacity="0.05" />
            <Stop offset="1" stopColor={colors.primary} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="odin-cyan-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={colors.cyan} stopOpacity="0.1" />
            <Stop offset="0.6" stopColor={colors.cyan} stopOpacity="0.025" />
            <Stop offset="1" stopColor={colors.cyan} stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect width="100%" height="100%" fill={colors.bg} />
        <Rect width="100%" height="100%" fill="url(#odin-grid)" />
        <Circle
          cx={width * 0.18}
          cy={height * 0.06}
          r={width * 0.95}
          fill="url(#odin-orange-glow)"
        />
        <Circle
          cx={width * 0.94}
          cy={height * 0.82}
          r={width * 0.85}
          fill="url(#odin-cyan-glow)"
        />
      </Svg>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(5,6,8,0)', 'rgba(5,6,8,0.22)', 'rgba(5,6,8,0.9)']}
        locations={[0, 0.6, 1]}
        style={StyleSheet.absoluteFill}
      />

      {!reduceMotion ? (
        <Animated.View style={[styles.scanline, scanStyle]}>
          <LinearGradient
            colors={[
              'rgba(255,106,0,0)',
              'rgba(255,106,0,0.12)',
              'rgba(103,223,255,0.06)',
              'rgba(255,106,0,0)',
            ]}
            locations={[0, 0.4, 0.7, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: alpha(colors.primary, 0.16),
    shadowColor: colors.primary,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
})
