import React from 'react'
import { Redirect } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'

export default function IndexScreen() {
  const { user } = useAuth()
  return <Redirect href={user ? '/(tabs)' : '/login'} />
}
