import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api, type User } from '../lib/api'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    const token = api.getToken()
    if (!token) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const userData = await api.getMe()
      setUser(userData)
    } catch {
      api.clearToken()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      await api.initialize()
      await refreshUser()
    }
    init()
  }, [refreshUser])

  const login = async (email: string, password: string) => {
    await api.login(email, password)
    await refreshUser()
  }

  const logout = async () => {
    await api.logout()
    await api.clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}