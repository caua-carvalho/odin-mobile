import { useAuth } from '../../contexts/AuthContext'
import { Redirect } from 'expo-router'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

export default function TabsLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return null
  }

  if (!user) {
    return <Redirect href="/login" />
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ff6b00',
        tabBarInactiveTintColor: '#686868',
        tabBarStyle: {
          backgroundColor: '#0a0a0a',
          borderTopColor: '#181818',
          height: 60,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="knowledge"
        options={{
          title: 'Biblioteca',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'library' : 'library-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Atividade',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="system"
        options={{
          title: 'Sistema',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'settings' : 'settings-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}