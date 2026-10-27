import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
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
    if (!token && !api.getRefreshToken()) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      const userData = await api.getMe()
      setUser(userData)
    } catch {
      await api.clearTokens()
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    api.setUnauthorizedHandler(() => setUser(null))
    const init = async () => {
      await api.initialize()
      await refreshUser()
    }
    void init()
    return () => api.setUnauthorizedHandler(null)
  }, [refreshUser])

  const login = useCallback(async (email: string, password: string) => {
    await api.login(email, password)
    const userData = await api.getMe()
    setUser(userData)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } finally {
      setUser(null)
      setLoading(false)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
