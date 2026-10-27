import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import { OdinStatusProvider } from '../contexts/OdinStatusContext'
import { useOdinFonts } from '../lib/fonts'
import { colors } from '../lib/theme'

void SplashScreen.preventAutoHideAsync().catch(() => undefined)

function RootNavigator() {
  const { user, loading } = useAuth()
  const [fontsLoaded, fontError] = useOdinFonts()
  const segments = useSegments()
  const router = useRouter()

  const ready = Boolean((fontsLoaded || fontError) && !loading)

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined)
  }, [ready])

  useEffect(() => {
    if (!ready) return
    const inAuth = segments[0] === 'login'
    if (!user && !inAuth) {
      router.replace('/login')
    } else if (user && inAuth) {
      router.replace('/(tabs)')
    }
  }, [ready, router, segments, user])

  if (!ready) return null

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="login" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      </Stack>
    </>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AuthProvider>
          <OdinStatusProvider>
            <RootNavigator />
          </OdinStatusProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
})
