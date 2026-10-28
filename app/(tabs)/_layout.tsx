import React from 'react'
import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router/js-tabs'
import { useAuth } from '../../contexts/AuthContext'
import { HudDock } from '../../components/hud/HudDock'
import { colors } from '../../lib/theme'

export default function TabsLayout() {
  const { user, loading } = useAuth()

  if (loading) return null
  if (!user) return <Redirect href="/login" />

  return (
    <Tabs
      backBehavior="history"
      tabBar={(props) => <HudDock {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Nexus' }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat' }} />
      <Tabs.Screen name="knowledge" options={{ title: 'Biblioteca' }} />
      <Tabs.Screen name="activity" options={{ title: 'Atividade' }} />
      <Tabs.Screen name="system" options={{ title: 'Telemetria' }} />
    </Tabs>
  )
}
