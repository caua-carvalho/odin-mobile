import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { api, type Approval, type Run } from '../lib/api'
import { useAuth } from './AuthContext'

const ACTIVE_STATUSES: Run['status'][] = ['queued', 'running', 'waiting_approval']

interface OdinStatusContextValue {
  pendingApprovals: Approval[]
  activeRuns: Run[]
  conversationTotal: number
  lastUpdated: string | null
  refreshing: boolean
  refresh: () => Promise<void>
}

const OdinStatusContext = createContext<OdinStatusContextValue | null>(null)

export function OdinStatusProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [pendingApprovals, setPendingApprovals] = useState<Approval[]>([])
  const [activeRuns, setActiveRuns] = useState<Run[]>([])
  const [conversationTotal, setConversationTotal] = useState(0)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const inFlight = useRef<Promise<void> | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (!user) return
    if (inFlight.current) return inFlight.current

    const task = (async () => {
      setRefreshing(true)
      const [approvalsResult, runsResult, conversationsResult] = await Promise.allSettled([
        api.listApprovals('pending'),
        api.listRuns({ page_size: 30 }),
        api.listConversations({ page_size: 1 }),
      ])

      if (approvalsResult.status === 'fulfilled') {
        setPendingApprovals(approvalsResult.value.items)
      }
      if (runsResult.status === 'fulfilled') {
        setActiveRuns(runsResult.value.filter((run) => ACTIVE_STATUSES.includes(run.status)))
      }
      if (conversationsResult.status === 'fulfilled') {
        setConversationTotal(conversationsResult.value.total)
      }
      setLastUpdated(new Date().toISOString())
      setRefreshing(false)
    })()

    inFlight.current = task.finally(() => {
      inFlight.current = null
    })
    return inFlight.current
  }, [user])

  useEffect(() => {
    if (!user) {
      setPendingApprovals([])
      setActiveRuns([])
      setConversationTotal(0)
      setLastUpdated(null)
      return
    }

    void refresh()
    const timer = setInterval(() => {
      void refresh()
    }, 20_000)
    return () => clearInterval(timer)
  }, [user, refresh])

  return (
    <OdinStatusContext.Provider
      value={{
        pendingApprovals,
        activeRuns,
        conversationTotal,
        lastUpdated,
        refreshing,
        refresh,
      }}
    >
      {children}
    </OdinStatusContext.Provider>
  )
}

export function useOdinStatus() {
  const context = useContext(OdinStatusContext)
  if (!context) throw new Error('useOdinStatus must be used within an OdinStatusProvider')
  return context
}
