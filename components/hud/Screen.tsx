import React, { type ReactNode } from 'react'
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '../../lib/theme'
import { HudBackdrop } from './Backdrop'

export const DOCK_SPACE = 104

interface HudScreenProps {
  children: ReactNode
  scroll?: boolean
  contentContainerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  refreshControl?: React.ReactElement<RefreshControlProps>
}

/**
 * Screen shell with the ODIN backdrop and the correct safe-area padding for
 * the floating dock.
 */
export function HudScreen({
  children,
  scroll = true,
  contentContainerStyle,
  style,
  refreshControl,
}: HudScreenProps) {
  const insets = useSafeAreaInsets()
  const bottomPadding = insets.bottom + DOCK_SPACE

  return (
    <View style={[styles.root, style]}>
      <HudBackdrop />
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            { paddingTop: insets.top + spacing.sm, paddingBottom: bottomPadding },
            contentContainerStyle,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View
          style={[
            styles.flex,
            { paddingTop: insets.top, paddingBottom: bottomPadding },
            contentContainerStyle,
          ]}
        >
          {children}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
})
