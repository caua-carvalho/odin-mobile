import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  type ScrollViewInstance,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated'
import { HudBackdrop } from '../../components/hud/Backdrop'
import { DOCK_SPACE } from '../../components/hud/Screen'
import {
  Badge,
  EmptyState,
  Panel,
  PressableScale,
} from '../../components/hud/primitives'

import { useOdinStatus } from '../../contexts/OdinStatusContext'
import { MarkdownMessage } from '../../components/chat/MarkdownMessage'
import {
  api,
  type Approval,
  type Conversation,
  type Message,
  type Run,
  type RunEvent,
} from '../../lib/api'
import { alpha, colors, fonts, radius, spacing } from '../../lib/theme'
import {
  formatRelativeTime,
  getErrorMessage,
  pluralize,
  pretty,
} from '../../lib/utils'

type ToolActivity = {
  call_id: string
  tool: string
  args?: unknown
  context?: string | null
  result?: string
  is_error?: boolean
  duration_s?: number | null
  status: 'running' | 'done'
}

type ApprovalCardData = {
  approval_id: string
  operation: string
  command?: string
  description?: string
  choices: string[]
}

type ConnectionState = 'idle' | 'connecting' | 'live' | 'reconnecting'

const ACTIVE_STATUSES: Run['status'][] = ['queued', 'running', 'waiting_approval']
const TERMINAL_STATUSES: Run['status'][] = [
  'completed',
  'failed',
  'cancelled',
  'interrupted',
]

function isActive(status: string | null | undefined) {
  return Boolean(status && ACTIVE_STATUSES.includes(status as Run['status']))
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function approvalFromEvent(data: Record<string, any>): ApprovalCardData {
  return {
    approval_id: String(data.approval_id || ''),
    operation: String(data.operation || data.details?.tool_name || 'ação'),
    command: data.command || data.details?.command || '',
    description: data.description || data.details?.description || '',
    choices:
      Array.isArray(data.choices) && data.choices.length
        ? data.choices.map(String)
        : ['once', 'deny'],
  }
}

function approvalFromRecord(record: Approval): ApprovalCardData {
  const details = (record.details || {}) as Record<string, any>
  return {
    approval_id: record.id,
    operation: record.operation || 'ação',
    command: details.command || '',
    description: details.description || '',
    choices:
      Array.isArray(details.choices) && details.choices.length
        ? details.choices.map(String)
        : ['once', 'deny'],
  }
}

function choiceLabel(choice: string): string {
  switch (choice) {
    case 'once':
      return 'Permitir'
    case 'session':
      return 'Nesta sessão'
    case 'always':
      return 'Sempre'
    case 'deny':
      return 'Negar'
    default:
      return choice
  }
}

function upsertTool(tools: ToolActivity[], data: Record<string, any>): ToolActivity[] {
  const id = String(data.call_id || data.tool || `tool-${tools.length}`)
  const index = tools.findIndex((tool) => tool.call_id === id)
  const next: ToolActivity = {
    call_id: id,
    tool: String(data.tool || 'ferramenta'),
    args: data.args,
    context: data.context || null,
    status: 'running',
  }
  if (index === -1) return [...tools, next]
  const copy = [...tools]
  copy[index] = { ...copy[index], ...next, status: copy[index].status }
  return copy
}

function completeTool(tools: ToolActivity[], data: Record<string, any>): ToolActivity[] {
  const id = String(data.call_id || data.tool || '')
  const index = tools.findIndex((tool) => tool.call_id === id)
  const done: ToolActivity = {
    call_id: id,
    tool: String(data.tool || (index >= 0 ? tools[index].tool : 'ferramenta')),
    args: index >= 0 ? tools[index].args : undefined,
    context: index >= 0 ? tools[index].context : null,
    result: pretty(data.result),
    is_error: Boolean(data.is_error),
    duration_s: data.duration_s ?? null,
    status: 'done',
  }
  if (index === -1) return [...tools, done]
  const copy = [...tools]
  copy[index] = { ...copy[index], ...done }
  return copy
}

function mergedTools(message: Message): ToolActivity[] {
  const byId = new Map<string, ToolActivity>()
  for (const call of message.tool_calls || []) {
    const id = String(call?.call_id || '')
    if (!id) continue
    byId.set(id, {
      call_id: id,
      tool: String(call.tool || 'ferramenta'),
      args: call.args,
      context: call.context || null,
      status: 'done',
    })
  }
  for (const result of message.tool_results || []) {
    const id = String(result?.call_id || '')
    if (!id) continue
    const previous = byId.get(id)
    byId.set(id, {
      call_id: id,
      tool: String(result.tool || previous?.tool || 'ferramenta'),
      args: previous?.args,
      context: previous?.context || null,
      result: pretty(result.result),
      is_error: Boolean(result.is_error),
      duration_s: result.duration_s ?? null,
      status: 'done',
    })
  }
  return Array.from(byId.values())
}

function runLabel(run: Run | null, liveStatus: string | null, connection: ConnectionState): string {
  if (run && isActive(run.status)) {
    if (liveStatus) return liveStatus
    if (connection === 'reconnecting') return 'Reconectando…'
    if (run.status === 'waiting_approval') return 'Aguardando aprovação'
    if (run.status === 'queued') return 'Na fila do agente'
    return 'Executando agente…'
  }
  if (run?.status === 'failed') return 'A execução falhou'
  if (run?.status === 'cancelled' || run?.status === 'interrupted') return 'Execução interrompida'
  if (run?.status === 'completed') return 'Concluída'
  return ''
}

const SUGGESTIONS = [
  'Faça um resumo dos recursos e capacidades atuais do sistema',
  'Quais arquivos e notas estão indexados na biblioteca?',
  'Verifique o estado da infraestrutura e dos agentes',
]

export default function ChatScreen() {
  const params = useLocalSearchParams<{ conversationId?: string | string[] }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const { refresh: refreshStatus } = useOdinStatus()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [liveText, setLiveText] = useState('')
  const [liveTools, setLiveTools] = useState<ToolActivity[]>([])
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [approval, setApproval] = useState<ApprovalCardData | null>(null)
  const [approvalBusy, setApprovalBusy] = useState<string | null>(null)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [queuedCount, setQueuedCount] = useState(0)
  const [connection, setConnection] = useState<ConnectionState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [showConversationPicker, setShowConversationPicker] = useState(false)

  const scrollRef = useRef<ScrollViewInstance>(null)
  const tempIdRef = useRef(0)
  const mountedRef = useRef(true)
  const currentConversationRef = useRef<Conversation | null>(null)
  const runRef = useRef<Run | null>(null)
  const openedConversationRef = useRef<string | null>(null)
  const finishTokenRef = useRef(0)
  const handleEventRef = useRef<(event: RunEvent) => void>(() => {})
  const openWsRef = useRef<() => void>(() => {})

  const wsRef = useRef<{
    socket: WebSocket | null
    runId: string | null
    conversationId: string | null
    lastSeq: number
    terminated: boolean
    retries: number
    timer: ReturnType<typeof setTimeout> | null
  }>({
    socket: null,
    runId: null,
    conversationId: null,
    lastSeq: 0,
    terminated: false,
    retries: 0,
    timer: null,
  })

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    currentConversationRef.current = currentConversation
  }, [currentConversation])

  useEffect(() => {
    runRef.current = run
  }, [run])

  const runActive = Boolean(run && isActive(run.status))

  const closeWs = useCallback(() => {
    const stream = wsRef.current
    stream.terminated = true
    stream.runId = null
    stream.lastSeq = 0
    stream.retries = 0
    if (stream.timer) {
      clearTimeout(stream.timer)
      stream.timer = null
    }
    if (stream.socket) {
      const socket = stream.socket
      stream.socket = null
      try {
        socket.close()
      } catch {
        // Already closed.
      }
    }
    if (mountedRef.current) setConnection('idle')
  }, [])

  const loadPendingApproval = useCallback(async (runId: string) => {
    try {
      const data = await api.listApprovals('pending', runId)
      const record = data?.items?.[0]
      if (record && mountedRef.current) setApproval(approvalFromRecord(record))
    } catch {
      // The live event is the primary path.
    }
  }, [])

  const openWs = useCallback(() => {
    const stream = wsRef.current
    if (!stream.runId || stream.terminated) return

    setConnection(stream.retries > 0 ? 'reconnecting' : 'connecting')
    const socket = new WebSocket(api.createRunWebSocketUrl(stream.runId, stream.lastSeq))
    stream.socket = socket

    socket.onopen = () => {
      if (wsRef.current.socket !== socket) return
      stream.retries = 0
      setConnection('live')
    }

    socket.onmessage = (messageEvent) => {
      if (wsRef.current.socket !== socket) return
      try {
        const event = JSON.parse(String(messageEvent.data)) as RunEvent
        if (event.type === 'heartbeat') return
        stream.lastSeq = Math.max(stream.lastSeq, Number(event.seq) || 0)
        handleEventRef.current(event)
      } catch {
        // Ignore malformed frames.
      }
    }

    socket.onerror = () => {
      // onclose handles reconnection.
    }

    socket.onclose = () => {
      if (wsRef.current.socket !== socket || stream.terminated) return
      stream.socket = null
      if (stream.retries >= 6) {
        setConnection('idle')
        return
      }
      stream.retries += 1
      setConnection('reconnecting')
      const wait = Math.min(1000 * 2 ** (stream.retries - 1), 8000)
      stream.timer = setTimeout(() => {
        stream.timer = null
        openWsRef.current()
      }, wait)
    }
  }, [])

  useEffect(() => {
    openWsRef.current = openWs
  }, [openWs])

  const attachRun = useCallback(
    (nextRun: Run) => {
      const stream = wsRef.current
      if (stream.runId === nextRun.id && stream.socket) return

      closeWs()
      setRun(nextRun)
      runRef.current = nextRun
      setLiveText('')
      setLiveTools([])
      setLiveStatus(null)
      setApproval(null)
      setApprovalError(null)

      stream.conversationId = nextRun.conversation_id
      if (!isActive(nextRun.status)) return

      stream.runId = nextRun.id
      stream.lastSeq = 0
      stream.terminated = false
      stream.retries = 0
      openWs()

      if (nextRun.status === 'waiting_approval') {
        void loadPendingApproval(nextRun.id)
      }
    },
    [closeWs, loadPendingApproval, openWs],
  )

  const finishRun = useCallback(
    async (runId: string, status: string, result?: string | null, runError?: string | null) => {
      const stream = wsRef.current
      if (stream.terminated) return
      if (stream.runId && runId && stream.runId !== runId) return

      stream.terminated = true
      if (stream.timer) {
        clearTimeout(stream.timer)
        stream.timer = null
      }
      if (stream.socket) {
        const socket = stream.socket
        stream.socket = null
        try {
          socket.close()
        } catch {
          // Already closed.
        }
      }
      stream.runId = null
      setConnection('idle')
      setLiveStatus(null)
      setApproval(null)
      setApprovalError(null)
      setRun((previous) =>
        previous && previous.id === runId
          ? {
              ...previous,
              status: status as Run['status'],
              completed_at: new Date().toISOString(),
              result_summary: result ?? previous.result_summary,
              error: runError ?? null,
            }
          : previous,
      )

      const conversationId = stream.conversationId
      if (!conversationId) return
      const token = ++finishTokenRef.current

      for (let attempt = 0; attempt < 5; attempt += 1) {
        await delay(attempt === 0 ? 150 : 300)
        if (!mountedRef.current || finishTokenRef.current !== token) return
        try {
          const [messageData, activeRun] = await Promise.all([
            api.listMessages(conversationId, { page_size: 200 }),
            api.getActiveRun(conversationId),
          ])
          if (!mountedRef.current || finishTokenRef.current !== token) return
          if (activeRun && activeRun.id !== runId) {
            setMessages(sortMessages(messageData.items))
            setLiveText('')
            setLiveTools([])
            attachRun(activeRun)
            const queued = await api.listRuns({
              conversation_id: conversationId,
              status: 'queued',
              page_size: 50,
            })
            if (mountedRef.current && finishTokenRef.current === token) {
              setQueuedCount(queued.length)
            }
            void refreshStatus()
            return
          }
          if (!activeRun) {
            setMessages(sortMessages(messageData.items))
            setLiveText('')
            setLiveTools([])
            const queued = await api.listRuns({
              conversation_id: conversationId,
              status: 'queued',
              page_size: 50,
            })
            if (mountedRef.current && finishTokenRef.current === token) {
              setQueuedCount(queued.length)
            }
            void refreshStatus()
            return
          }
        } catch {
          // Retry until the fallback below.
        }
      }

      if (!mountedRef.current || finishTokenRef.current !== token) return
      try {
        const messageData = await api.listMessages(conversationId, { page_size: 200 })
        if (mountedRef.current && finishTokenRef.current === token) {
          setMessages(sortMessages(messageData.items))
          setLiveText('')
          setLiveTools([])
        }
      } catch {
        // Keep the live text as a fallback.
      }
      void refreshStatus()
    },
    [attachRun, refreshStatus],
  )

  const handleEvent = useCallback(
    (event: RunEvent) => {
      const data = (event.data || {}) as Record<string, any>
      const eventRunId = event.run_id || wsRef.current.runId || ''

      switch (event.type) {
        case 'run_queued':
          setRun((previous) => (previous ? { ...previous, status: 'queued' } : previous))
          setLiveStatus(
            Number(data.position) > 0 ? `Na fila (${Number(data.position)}º)` : 'Na fila',
          )
          break

        case 'run_started':
        case 'session_started':
          setRun((previous) => (previous ? { ...previous, status: 'running' } : previous))
          setLiveStatus('Conectando ao agente…')
          break

        case 'message_start':
          setLiveStatus(null)
          break

        case 'token': {
          const delta = data.delta ?? data.text
          if (typeof delta === 'string' && delta) {
            setLiveText((previous) => previous + delta)
            setLiveStatus(null)
          }
          break
        }

        case 'reasoning':
          setLiveStatus('Raciocinando…')
          break

        case 'status':
          if (typeof data.text === 'string' && data.text) setLiveStatus(data.text)
          else if (typeof data.message === 'string' && data.message) setLiveStatus(data.message)
          break

        case 'title': {
          const title = typeof data.title === 'string' ? data.title : ''
          if (!title) break
          const conversationId = data.conversation_id || wsRef.current.conversationId
          setConversations((previous) =>
            previous.map((conversation) =>
              conversation.id === conversationId ? { ...conversation, title } : conversation,
            ),
          )
          setCurrentConversation((previous) => (previous ? { ...previous, title } : previous))
          break
        }

        case 'tool_call':
          setLiveTools((previous) => upsertTool(previous, data))
          setLiveStatus(`Executando ${String(data.tool || 'ferramenta')}…`)
          break

        case 'tool_result':
          setLiveTools((previous) => completeTool(previous, data))
          setLiveStatus(null)
          break

        case 'approval_requested': {
          const card = approvalFromEvent(data)
          if (!card.approval_id) break
          setApproval(card)
          setApprovalError(null)
          setRun((previous) => (previous ? { ...previous, status: 'waiting_approval' } : previous))
          setLiveStatus('Aguardando sua aprovação')
          void refreshStatus()
          break
        }

        case 'approval_resolved':
          setApproval(null)
          setRun((previous) => (previous ? { ...previous, status: 'running' } : previous))
          setLiveStatus('Aprovação enviada')
          void refreshStatus()
          break

        case 'approval_cancelled':
          setApproval(null)
          setRun((previous) => (previous ? { ...previous, status: 'running' } : previous))
          setLiveStatus('Aprovação cancelada')
          break

        case 'run_stopping':
          setLiveStatus(typeof data.reason === 'string' ? data.reason : 'Interrompendo…')
          break

        case 'run_completed':
          void finishRun(
            eventRunId,
            'completed',
            typeof data.result === 'string' ? data.result : null,
            null,
          )
          break

        case 'run_failed':
          void finishRun(
            eventRunId,
            'failed',
            typeof data.result === 'string' ? data.result : null,
            typeof data.error === 'string' ? data.error : 'A execução falhou.',
          )
          break

        case 'run_cancelled':
          void finishRun(
            eventRunId,
            'cancelled',
            typeof data.result === 'string' ? data.result : null,
            typeof data.reason === 'string' ? data.reason : null,
          )
          break

        case 'run_snapshot': {
          const status = String(data.status || '')
          if (!data.active || TERMINAL_STATUSES.includes(status as Run['status'])) {
            void finishRun(
              eventRunId,
              TERMINAL_STATUSES.includes(status as Run['status']) ? status : 'failed',
              typeof data.result_summary === 'string' ? data.result_summary : null,
              typeof data.error === 'string' ? data.error : null,
            )
          }
          break
        }

        case 'error':
          if (typeof data.error === 'string') setLiveStatus(data.error)
          break
      }
    },
    [finishRun, refreshStatus],
  )

  useEffect(() => {
    handleEventRef.current = handleEvent
  }, [handleEvent])

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.listConversations({ page_size: 100 })
      if (mountedRef.current) setConversations(data.items)
    } catch (err) {
      if (mountedRef.current) setError(getErrorMessage(err, 'Erro ao carregar conversas.'))
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial fetch; state updates happen after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations()
  }, [loadConversations])

  useEffect(
    () => () => {
      closeWs()
    },
    [closeWs],
  )

  const resetRunState = useCallback(() => {
    ++finishTokenRef.current
    closeWs()
    setRun(null)
    runRef.current = null
    setLiveText('')
    setLiveTools([])
    setLiveStatus(null)
    setApproval(null)
    setApprovalError(null)
    setQueuedCount(0)
    setElapsed(0)
  }, [closeWs])

  const openConversation = useCallback(
    async (conversation: Conversation) => {
      openedConversationRef.current = conversation.id
      resetRunState()
      setCurrentConversation(conversation)
      currentConversationRef.current = conversation
      setMessages([])
      setLoadingMessages(true)
      setError(null)

      try {
        const [messageData, activeRun, queued] = await Promise.all([
          api.listMessages(conversation.id, { page_size: 200 }),
          api.getActiveRun(conversation.id),
          api.listRuns({ conversation_id: conversation.id, status: 'queued', page_size: 50 }),
        ])
        if (!mountedRef.current) return
        setMessages(sortMessages(messageData.items))
        setQueuedCount(queued.length)
        if (activeRun) attachRun(activeRun)
      } catch (err) {
        if (mountedRef.current) {
          setError(getErrorMessage(err, 'Erro ao carregar a conversa.'))
        }
      } finally {
        if (mountedRef.current) setLoadingMessages(false)
      }
    },
    [attachRun, resetRunState],
  )

  // Deep link support: /(tabs)/chat?conversationId=...
  useEffect(() => {
    const raw = params.conversationId
    const id = Array.isArray(raw) ? raw[0] : raw
    if (!id || openedConversationRef.current === id) return

    const known = conversations.find((conversation) => conversation.id === id)
    if (known) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- opening a conversation is an async data load
      void openConversation(known)
      return
    }

    openedConversationRef.current = id
    api
      .getConversation(id)
      .then((conversation) => {
        if (!mountedRef.current) return
        setConversations((previous) =>
          previous.some((item) => item.id === conversation.id)
            ? previous
            : [conversation, ...previous],
        )
        void openConversation(conversation)
      })
      .catch(() => {
        openedConversationRef.current = null
        if (mountedRef.current) setError('Sessão não encontrada. Abra outra conversa no histórico.')
      })
  }, [conversations, openConversation, params.conversationId])

  useEffect(() => {
    if (!runActive) {
      // Reset the elapsed counter when the run settles.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setElapsed(0)
      return
    }
    const started = Date.now()
    setElapsed(0)
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [runActive, run?.id])

  useEffect(() => {
    if (messages.length === 0 && !liveText) return
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true })
    }, 60)
    return () => clearTimeout(timer)
  }, [approval, liveText, liveTools, messages, runActive])

  const handleNewChat = () => {
    resetRunState()
    setCurrentConversation(null)
    currentConversationRef.current = null
    openedConversationRef.current = null
    setMessages([])
    setInputValue('')
    setError(null)
    setShowConversationPicker(false)
    router.setParams({ conversationId: '' })
  }

  const selectConversation = (conversation: Conversation) => {
    setShowConversationPicker(false)
    router.setParams({ conversationId: conversation.id })
    void openConversation(conversation)
  }

  const deleteConversation = (conversation: Conversation) => {
    Alert.alert(
      'Excluir sessão',
      `Remover "${conversation.title || conversation.id.slice(0, 8)}" e todo o histórico?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await api.deleteConversation(conversation.id)
                setConversations((previous) =>
                  previous.filter((item) => item.id !== conversation.id),
                )
                if (currentConversationRef.current?.id === conversation.id) {
                  handleNewChat()
                }
                void refreshStatus()
              } catch (err) {
                Alert.alert('Falha', getErrorMessage(err, 'Não foi possível excluir a sessão.'))
              }
            })()
          },
        },
      ],
    )
  }

  const sendMessage = async (content: string) => {
    const text = content.trim()
    if (!text || sending) return

    setSending(true)
    setError(null)
    const existing = currentConversationRef.current
    const wasActive = Boolean(runRef.current && isActive(runRef.current.status))
    const tempId = `temp_${++tempIdRef.current}`

    try {
      const created = existing
        ? null
        : await api.createConversation({ title: text.slice(0, 60) })
      const conversationId = existing?.id ?? created!.id

      if (created) {
        setConversations((previous) => [created, ...previous])
        setCurrentConversation(created)
        currentConversationRef.current = created
        openedConversationRef.current = created.id
        router.setParams({ conversationId: created.id })
      }

      setMessages((previous) => [
        ...previous,
        {
          id: tempId,
          conversation_id: conversationId,
          role: 'user',
          content: text,
          created_at: new Date().toISOString(),
          run_id: null,
        } as Message,
      ])
      setInputValue('')

      const knownTitle = currentConversationRef.current?.title ?? ''
      if (!knownTitle) {
        const title = text.slice(0, 80)
        const base = currentConversationRef.current
        if (base) {
          const titled = { ...base, title }
          setCurrentConversation(titled)
          currentConversationRef.current = titled
        }
        setConversations((previous) =>
          previous.map((item) => (item.id === conversationId ? { ...item, title } : item)),
        )
      }

      const newRun = await api.createRun(conversationId, { message: text })
      if (wasActive) {
        setQueuedCount((previous) => previous + 1)
        setLiveStatus('Mensagem na fila do agente')
      } else {
        attachRun(newRun)
      }

      const messageData = await api.listMessages(conversationId, { page_size: 200 })
      if (mountedRef.current) setMessages(sortMessages(messageData.items))
      void refreshStatus()
    } catch (err) {
      if (mountedRef.current) {
        setMessages((previous) => previous.filter((message) => message.id !== tempId))
        setError(getErrorMessage(err, 'Erro ao enviar mensagem.'))
      }
    } finally {
      if (mountedRef.current) setSending(false)
    }
  }

  const stopRun = async () => {
    if (!run || !isActive(run.status)) return
    setLiveStatus('Interrompendo…')
    try {
      await api.stopRun(run.id)
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao interromper a execução.'))
      setLiveStatus(null)
    }
  }

  const resolveApproval = async (choice: string) => {
    if (!approval || approvalBusy) return
    setApprovalBusy(choice)
    setApprovalError(null)
    try {
      if (choice === 'deny') await api.deny(approval.approval_id, choice)
      else await api.approve(approval.approval_id, choice)
      setApproval(null)
      setLiveStatus('Aprovação enviada')
      void refreshStatus()
    } catch (err) {
      setApprovalError(getErrorMessage(err, 'Falha ao responder ao Hermes.'))
    } finally {
      if (mountedRef.current) setApprovalBusy(null)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadConversations()
    if (currentConversationRef.current) {
      await openConversation(currentConversationRef.current)
    }
    await refreshStatus()
    if (mountedRef.current) setRefreshing(false)
  }

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user'
    const tools = message.role === 'assistant' ? mergedTools(message) : []

    if (message.role === 'assistant' && !message.content.trim() && tools.length === 0) {
      return null
    }

    return (
      <Animated.View
        key={message.id}
        entering={FadeInDown.duration(240)}
        style={[styles.messageRow, isUser ? styles.messageRowUser : styles.messageRowAssistant]}
      >
        {!isUser ? (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={13} color={colors.primaryLight} />
          </View>
        ) : null}
        <View style={[styles.bubble, isUser ? styles.userBubble : styles.assistantBubble]}>
          {tools.map((tool) => (
            <View key={tool.call_id} style={styles.toolRow}>
              <View style={styles.toolHeader}>
                <Ionicons
                  name={tool.is_error ? 'close-circle' : 'terminal-outline'}
                  size={13}
                  color={tool.is_error ? colors.dangerLight : colors.primaryLight}
                />
                <Text style={styles.toolName} numberOfLines={1}>
                  {tool.tool}
                </Text>
                {typeof tool.duration_s === 'number' ? (
                  <Text style={styles.toolDuration}>{tool.duration_s.toFixed(1)}s</Text>
                ) : null}
              </View>
              {tool.result ? (
                <Text style={styles.toolResult} numberOfLines={6}>
                  {tool.result}
                </Text>
              ) : null}
            </View>
          ))}
          {message.content ? (
            isUser ? (
              <Text style={styles.userText}>{message.content}</Text>
            ) : (
              <MarkdownMessage content={message.content} />
            )
          ) : null}
          <Text style={[styles.messageTime, isUser && styles.messageTimeUser]}>
            {formatRelativeTime(message.created_at)}
          </Text>
        </View>
      </Animated.View>
    )
  }

  const showEmptyState = messages.length === 0 && !runActive && !loadingMessages
  const bottomSpace = insets.bottom + DOCK_SPACE

  return (
    <View style={styles.root}>
      <HudBackdrop />

      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.headerLeft}>
          <PressableScale
            accessibilityLabel="Abrir histórico de conversas"
            haptic="selection"
            onPress={() => setShowConversationPicker(true)}
          >
            <View style={styles.headerButton}>
              <Ionicons name="menu-outline" size={20} color={colors.text} />
            </View>
          </PressableScale>
          <View style={styles.headerCopy}>
            <View style={styles.headerEyebrowRow}>
              <Text style={styles.headerEyebrow}>Canal neural</Text>
              <ConnectionBadge connection={connection} />
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentConversation?.title || 'Nova sessão'}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <PressableScale
            accessibilityLabel="Nova conversa"
            haptic="selection"
            onPress={handleNewChat}
          >
            <View style={styles.headerButton}>
              <Ionicons name="add" size={21} color={colors.primaryLight} />
            </View>
          </PressableScale>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {runActive ? (
          <Animated.View entering={FadeIn.duration(180)} style={styles.runBar}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    connection === 'live'
                      ? colors.successLight
                      : connection === 'reconnecting'
                        ? colors.warning
                        : colors.cyan,
                },
              ]}
            />
            <Text style={styles.runBarText} numberOfLines={1}>
              {runLabel(run, liveStatus, connection)}
            </Text>
            <Text style={styles.runBarElapsed}>{elapsed}s</Text>
            <PressableScale
              accessibilityLabel="Interromper execução"
              haptic="medium"
              onPress={() => void stopRun()}
            >
              <View style={styles.stopButton}>
                <Ionicons name="square" size={12} color={colors.dangerLight} />
              </View>
            </PressableScale>
          </Animated.View>
        ) : null}

        {queuedCount > 0 ? (
          <View style={styles.queueBar}>
            <Ionicons name="time-outline" size={13} color={colors.warningLight} />
            <Text style={styles.queueText}>
              {queuedCount} {pluralize(queuedCount, 'mensagem na fila', 'mensagens na fila')}
            </Text>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[
            styles.messagesList,
            showEmptyState && styles.messagesListEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.elevated}
            />
          }
        >
          {loadingMessages ? (
            <View style={styles.messagesLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.messagesLoadingText}>Sincronizando sessão…</Text>
            </View>
          ) : null}

          {showEmptyState ? (
            <View style={styles.emptyWrap}>
              <EmptyState
                icon="chatbubbles-outline"
                title={currentConversation ? 'Sessão sem mensagens' : 'Canal neural em prontidão'}
                description={
                  currentConversation
                    ? 'Envie a primeira diretriz para iniciar esta sessão.'
                    : 'Converse com o Hermes em tempo real, com ferramentas e autorizações no fluxo.'
                }
              />
              <View style={styles.suggestionList}>
                {SUGGESTIONS.map((suggestion) => (
                  <PressableScale
                    key={suggestion}
                    accessibilityLabel={`Enviar sugestão: ${suggestion}`}
                    haptic="selection"
                    onPress={() => void sendMessage(suggestion)}
                    style={styles.suggestionPress}
                  >
                    <View style={styles.suggestionRow}>
                      <Ionicons name="sparkles-outline" size={14} color={colors.cyan} />
                      <Text style={styles.suggestionText} numberOfLines={2}>
                        {suggestion}
                      </Text>
                    </View>
                  </PressableScale>
                ))}
              </View>
            </View>
          ) : null}

          {messages.map(renderMessage)}

          {runActive ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.messageRowAssistant}>
              <View style={styles.avatar}>
                <Ionicons name="sparkles" size={13} color={colors.primaryLight} />
              </View>
              <View style={[styles.bubble, styles.assistantBubble, styles.liveBubble]}>
                {liveTools.map((tool) => (
                  <View key={tool.call_id} style={styles.toolRow}>
                    <View style={styles.toolHeader}>
                      {tool.status === 'running' ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <Ionicons
                          name={tool.is_error ? 'close-circle' : 'checkmark-circle'}
                          size={13}
                          color={tool.is_error ? colors.dangerLight : colors.successLight}
                        />
                      )}
                      <Text style={styles.toolName} numberOfLines={1}>
                        {tool.tool}
                      </Text>
                    </View>
                    {tool.result ? (
                      <Text style={styles.toolResult} numberOfLines={5}>
                        {tool.result}
                      </Text>
                    ) : null}
                  </View>
                ))}

                {liveText ? (
                  <MarkdownMessage content={liveText} streaming />
                ) : (
                  <View style={styles.thinkingRow}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.thinkingText}>{liveStatus || 'Pensando…'}</Text>
                  </View>
                )}

                {liveText && liveStatus ? (
                  <Text style={styles.liveStatus}>{liveStatus}</Text>
                ) : null}
              </View>
            </Animated.View>
          ) : null}

          {approval ? (
            <Animated.View entering={FadeInDown.duration(260)}>
              <Panel glow="orange" style={styles.approvalCard}>
                <View style={styles.approvalHeader}>
                  <View style={styles.approvalIcon}>
                    <Ionicons name="shield-half-outline" size={17} color={colors.warningLight} />
                  </View>
                  <View style={styles.approvalCopy}>
                    <Text style={styles.approvalEyebrow}>Autorização necessária</Text>
                    <Text style={styles.approvalTitle} numberOfLines={2}>
                      {approval.operation}
                    </Text>
                  </View>
                  <Badge label="Pendente" tone="warning" dot />
                </View>

                {approval.description ? (
                  <Text style={styles.approvalDescription}>{approval.description}</Text>
                ) : null}

                {approval.command ? (
                  <View style={styles.commandPreview}>
                    <Text style={styles.commandPreviewText} numberOfLines={8}>
                      {approval.command}
                    </Text>
                  </View>
                ) : null}

                {approvalError ? <Text style={styles.approvalError}>{approvalError}</Text> : null}

                <View style={styles.approvalButtons}>
                  {approval.choices.map((choice) => {
                    const deny = choice === 'deny'
                    const busy = approvalBusy === choice
                    return (
                      <PressableScale
                        key={choice}
                        accessibilityLabel={choiceLabel(choice)}
                        haptic={deny ? 'light' : 'medium'}
                        disabled={Boolean(approvalBusy)}
                        onPress={() => void resolveApproval(choice)}
                        style={styles.approvalButtonPress}
                      >
                        <View
                          style={[
                            styles.approvalButton,
                            deny ? styles.approvalButtonDeny : styles.approvalButtonAllow,
                            approvalBusy && !busy && styles.approvalButtonMuted,
                          ]}
                        >
                          {busy ? (
                            <ActivityIndicator
                              size="small"
                              color={deny ? colors.dangerLight : colors.white}
                            />
                          ) : (
                            <Ionicons
                              name={deny ? 'close' : 'checkmark'}
                              size={14}
                              color={deny ? colors.dangerLight : colors.white}
                            />
                          )}
                          <Text
                            style={[
                              styles.approvalButtonText,
                              { color: deny ? colors.dangerLight : colors.white },
                            ]}
                          >
                            {choiceLabel(choice)}
                          </Text>
                        </View>
                      </PressableScale>
                    )
                  })}
                </View>
              </Panel>
            </Animated.View>
          ) : null}

          {run && !runActive && run.status === 'failed' && run.error ? (
            <View style={[styles.bubble, styles.assistantBubble, styles.errorBubble]}>
              <View style={styles.toolHeader}>
                <Ionicons name="warning-outline" size={14} color={colors.dangerLight} />
                <Text style={styles.errorBubbleTitle}>Execução interrompida</Text>
              </View>
              <Text style={styles.errorBubbleText}>{run.error}</Text>
            </View>
          ) : null}

          <View style={styles.scrollSpacer} />
        </ScrollView>

        <View style={[styles.composerWrap, { paddingBottom: bottomSpace }]}>
          {error ? (
            <View style={styles.inlineError}>
              <Ionicons name="warning-outline" size={13} color={colors.dangerLight} />
              <Text style={styles.inlineErrorText}>{error}</Text>
              <Pressable onPress={() => setError(null)} hitSlop={8}>
                <Ionicons name="close" size={13} color={colors.dangerLight} />
              </Pressable>
            </View>
          ) : null}

          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={
                runActive ? 'Enviar outra diretriz — entra na fila…' : 'Transmitir mensagem…'
              }
              placeholderTextColor={colors.dim}
              multiline
              maxLength={4000}
              editable={!sending}
              selectionColor={colors.primary}
            />
            <PressableScale
              accessibilityLabel="Enviar mensagem"
              haptic="medium"
              onPress={() => void sendMessage(inputValue)}
              disabled={!inputValue.trim() || sending}
              style={[
                styles.sendButton,
                (!inputValue.trim() || sending) && styles.sendButtonDisabled,
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <Ionicons name="arrow-up" size={19} color={colors.bg} />
              )}
            </PressableScale>
          </View>

          <View style={styles.composerFooter}>
            <Text style={styles.composerHint}>
              {currentConversation
                ? `${currentConversation.message_count} ${pluralize(currentConversation.message_count, 'mensagem', 'mensagens')}`
                : 'Nova sessão neural'}
            </Text>
            <Text style={styles.composerHint}>ODIN · MOBILE ARM</Text>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showConversationPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowConversationPicker(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar histórico"
            style={styles.modalBackdrop}
            onPress={() => setShowConversationPicker(false)}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>Histórico neural</Text>
                <Text style={styles.sheetTitle}>Sessões</Text>
              </View>
              <PressableScale
                accessibilityLabel="Fechar histórico"
                haptic="selection"
                onPress={() => setShowConversationPicker(false)}
              >
                <View style={styles.sheetClose}>
                  <Ionicons name="close" size={19} color={colors.muted} />
                </View>
              </PressableScale>
            </View>

            <PressableScale
              accessibilityLabel="Iniciar nova conversa"
              haptic="medium"
              onPress={handleNewChat}
              style={styles.newSessionPress}
            >
              <View style={styles.newSessionRow}>
                <View style={styles.newSessionIcon}>
                  <Ionicons name="add" size={17} color={colors.bg} />
                </View>
                <Text style={styles.newSessionText}>Nova sessão neural</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.faint} />
              </View>
            </PressableScale>

            <ScrollView
              style={styles.sheetList}
              contentContainerStyle={styles.sheetListContent}
              showsVerticalScrollIndicator={false}
            >
              {loading && conversations.length === 0 ? (
                <View style={styles.sheetLoading}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : conversations.length === 0 ? (
                <Text style={styles.sheetEmpty}>Nenhuma sessão registrada ainda.</Text>
              ) : (
                conversations.map((conversation) => {
                  const selected = currentConversation?.id === conversation.id
                  return (
                    <View key={conversation.id} style={styles.sheetItem}>
                      <PressableScale
                        accessibilityLabel={`Abrir ${conversation.title ?? 'conversa'}`}
                        haptic="selection"
                        onPress={() => selectConversation(conversation)}
                        style={styles.sheetItemPress}
                      >
                        <View style={styles.sheetItemRow}>
                          <View
                            style={[
                              styles.sheetItemIcon,
                              selected && styles.sheetItemIconActive,
                            ]}
                          >
                            <Ionicons
                              name={selected ? 'radio' : 'chatbubble-ellipses-outline'}
                              size={15}
                              color={selected ? colors.primaryLight : colors.dim}
                            />
                          </View>
                          <View style={styles.sheetItemCopy}>
                            <Text
                              style={[styles.sheetItemTitle, selected && styles.sheetItemTitleActive]}
                              numberOfLines={1}
                            >
                              {conversation.title || `Sessão ${conversation.id.slice(0, 8)}`}
                            </Text>
                            <Text style={styles.sheetItemMeta}>
                              {conversation.message_count}{' '}
                              {pluralize(conversation.message_count, 'mensagem', 'mensagens')} ·{' '}
                              {formatRelativeTime(conversation.updated_at)}
                            </Text>
                          </View>
                        </View>
                      </PressableScale>
                      <Pressable
                        accessibilityLabel="Excluir conversa"
                        onPress={() => deleteConversation(conversation)}
                        hitSlop={8}
                        style={styles.sheetDelete}
                      >
                        <Ionicons name="trash-outline" size={15} color={colors.faint} />
                      </Pressable>
                    </View>
                  )
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  )
}

function ConnectionBadge({ connection }: { connection: ConnectionState }) {
  if (connection === 'idle') return null
  const label =
    connection === 'live'
      ? 'STREAM'
      : connection === 'reconnecting'
        ? 'RECONEXÃO'
        : 'CONECTANDO'
  const color =
    connection === 'live'
      ? colors.successLight
      : connection === 'reconnecting'
        ? colors.warningLight
        : colors.cyan
  return (
    <View style={[styles.connectionBadge, { borderColor: alpha(color, 0.34) }]}>
      <View style={[styles.connectionDot, { backgroundColor: color }]} />
      <Text style={[styles.connectionText, { color }]}>{label}</Text>
    </View>
  )
}

function sortMessages(items: Message[]): Message[] {
  return [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: alpha(colors.surface, 0.72),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
    minWidth: 0,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headerEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerEyebrow: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.5,
    color: colors.primaryLight,
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    letterSpacing: -0.2,
    color: colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.8),
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    backgroundColor: alpha(colors.bg, 0.4),
  },
  connectionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  connectionText: {
    fontFamily: fonts.monoBold,
    fontSize: 6,
    letterSpacing: 0.6,
  },
  runBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.55),
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  runBarText: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSoft,
  },
  runBarElapsed: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.dim,
  },
  stopButton: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.34),
    backgroundColor: alpha(colors.danger, 0.1),
  },
  queueBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.warning, 0.22),
    backgroundColor: alpha(colors.warning, 0.06),
  },
  queueText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.warningLight,
  },
  messagesList: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  messagesListEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  messagesLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  messagesLoadingText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  messageRow: {
    flexDirection: 'row',
    gap: 7,
    maxWidth: '92%',
  },
  messageRowUser: {
    alignSelf: 'flex-end',
    justifyContent: 'flex-end',
  },
  messageRowAssistant: {
    alignSelf: 'flex-start',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.3),
    backgroundColor: alpha(colors.primary, 0.08),
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    gap: 7,
    minWidth: 0,
  },
  userBubble: {
    backgroundColor: alpha(colors.primary, 0.14),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.34),
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    flex: 1,
    backgroundColor: alpha(colors.surface, 0.9),
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.95),
    borderBottomLeftRadius: 4,
  },
  liveBubble: {
    borderColor: alpha(colors.primary, 0.24),
  },
  userText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  messageTime: {
    fontFamily: fonts.mono,
    fontSize: 7,
    letterSpacing: 0.4,
    color: colors.faint,
  },
  messageTimeUser: {
    textAlign: 'right',
  },
  toolRow: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(colors.border, 0.85),
    backgroundColor: alpha(colors.bg, 0.5),
    paddingHorizontal: spacing.xs,
    paddingVertical: 6,
    gap: 4,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  toolName: {
    flex: 1,
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: colors.textSoft,
  },
  toolDuration: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
  },
  toolResult: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 14,
    color: colors.dim,
  },
  thinkingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  thinkingText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.muted,
  },
  liveStatus: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.dim,
  },
  errorBubble: {
    borderColor: alpha(colors.danger, 0.35),
    backgroundColor: alpha(colors.danger, 0.06),
  },
  errorBubbleTitle: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: colors.dangerLight,
  },
  errorBubbleText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.dangerLight,
  },
  scrollSpacer: {
    height: 4,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
  },
  suggestionList: {
    alignSelf: 'stretch',
    gap: spacing.xs,
    marginTop: spacing.sm,
    maxWidth: 440,
  },
  suggestionPress: {
    alignSelf: 'stretch',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.surface, 0.72),
  },
  suggestionText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSoft,
  },
  approvalCard: {
    marginTop: spacing.xs,
    borderColor: alpha(colors.warning, 0.34),
    backgroundColor: alpha(colors.warning, 0.055),
  },
  approvalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  approvalIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.warning, 0.3),
    backgroundColor: alpha(colors.warning, 0.1),
  },
  approvalCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  approvalEyebrow: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.warningLight,
    textTransform: 'uppercase',
  },
  approvalTitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  approvalDescription: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
    marginTop: spacing.xs,
  },
  commandPreview: {
    marginTop: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(colors.warning, 0.24),
    backgroundColor: alpha(colors.bg, 0.7),
  },
  commandPreviewText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 14,
    color: colors.textSoft,
  },
  approvalError: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
    color: colors.dangerLight,
    marginTop: spacing.xs,
  },
  approvalButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  approvalButtonPress: {
    flexGrow: 1,
  },
  approvalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    minWidth: 84,
  },
  approvalButtonAllow: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  approvalButtonDeny: {
    backgroundColor: alpha(colors.danger, 0.12),
    borderColor: alpha(colors.danger, 0.34),
  },
  approvalButtonMuted: {
    opacity: 0.4,
  },
  approvalButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
  composerWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: alpha(colors.bg, 0.94),
  },
  inlineError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.3),
    backgroundColor: alpha(colors.danger, 0.08),
    paddingHorizontal: spacing.xs,
    paddingVertical: 5,
    marginBottom: spacing.xs,
  },
  inlineErrorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    color: colors.dangerLight,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingLeft: spacing.md,
    paddingRight: 5,
    paddingVertical: 5,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.26),
    backgroundColor: alpha(colors.surface, 0.94),
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    paddingTop: 9,
    paddingBottom: 9,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  sendButtonDisabled: {
    opacity: 0.35,
  },
  composerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 5,
  },
  composerHint: {
    fontFamily: fonts.mono,
    fontSize: 7,
    letterSpacing: 0.5,
    color: colors.faint,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 3, 5, 0.62)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    maxHeight: '78%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderBright,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sheetEyebrow: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.primaryLight,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: -0.6,
    color: colors.text,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.8),
  },
  newSessionPress: {
    alignSelf: 'stretch',
    marginBottom: spacing.xs,
  },
  newSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.3),
    backgroundColor: alpha(colors.primary, 0.08),
  },
  newSessionIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  newSessionText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  sheetList: {
    marginTop: spacing.xs,
  },
  sheetListContent: {
    paddingBottom: spacing.sm,
    gap: 4,
  },
  sheetLoading: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  sheetEmpty: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.dim,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.55),
  },
  sheetItemPress: {
    flex: 1,
    minWidth: 0,
  },
  sheetItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  sheetItemIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.bg, 0.55),
  },
  sheetItemIconActive: {
    borderColor: alpha(colors.primary, 0.36),
    backgroundColor: alpha(colors.primary, 0.1),
  },
  sheetItemCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  sheetItemTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSoft,
  },
  sheetItemTitleActive: {
    color: colors.text,
  },
  sheetItemMeta: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
  },
  sheetDelete: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
})
