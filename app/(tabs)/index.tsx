import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { api, type Approval, type Conversation, type Message, type Run, type RunEvent } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'

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

type ApprovalCard = {
  approval_id: string
  operation: string
  command?: string
  description?: string
  choices: string[]
}

type ConnectionState = 'idle' | 'connecting' | 'live' | 'reconnecting'

const ACTIVE_STATUSES = ['queued', 'running', 'waiting_approval']
const TERMINAL_STATUSES = ['completed', 'failed', 'cancelled', 'interrupted']

function isActive(status: string | null | undefined) {
  return Boolean(status && ACTIVE_STATUSES.includes(status))
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function pretty(value: unknown, limit = 1200): string {
  if (value === null || value === undefined) return ''
  let text: string
  if (typeof value === 'string') text = value
  else {
    try {
      text = JSON.stringify(value, null, 2)
    } catch {
      text = String(value)
    }
  }
  return text.length > limit ? `${text.slice(0, limit)}…` : text
}

function approvalFromEvent(data: Record<string, any>): ApprovalCard {
  return {
    approval_id: String(data.approval_id || ''),
    operation: String(data.operation || data.details?.tool_name || 'ação'),
    command: data.command || data.details?.command || '',
    description: data.description || data.details?.description || '',
    choices: Array.isArray(data.choices) && data.choices.length ? data.choices.map(String) : ['once', 'deny'],
  }
}

function approvalFromRecord(record: Approval): ApprovalCard {
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
    return 'Executando agente...'
  }
  if (run?.status === 'failed') return 'A execução falhou'
  if (run?.status === 'cancelled' || run?.status === 'interrupted') return 'Execução interrompida'
  if (run?.status === 'completed') return 'Concluída'
  return ''
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#181818' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#ff6b00' },
  newChatBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#181818', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  newChatBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  messagesContainer: { flex: 1 },
  messagesList: { padding: 16, paddingBottom: 40 },
  messageBubble: { maxWidth: '85%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, marginVertical: 4 },
  userBubble: { backgroundColor: '#ff6b00', alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#181818', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#282828' },
  toolBubble: { backgroundColor: '#181818', alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#3a2a1a' },
  messageText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  toolText: { color: '#a8a8a8', fontSize: 13, fontFamily: 'monospace' },
  inputContainer: { padding: 12, paddingBottom: 20, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#181818' },
  inputWrapper: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, backgroundColor: '#181818', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#282828' },
  textInput: { flex: 1, color: '#fff', fontSize: 16, maxHeight: 120 },
  sendBtn: { backgroundColor: '#ff6b00', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  stopBtn: { backgroundColor: '#e05600', width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  emptyState: { justifyContent: 'center', alignItems: 'center', padding: 24, paddingTop: 80 },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { color: '#686868', fontSize: 14, textAlign: 'center' },
  loadingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  typingIndicator: { flexDirection: 'row', gap: 4, paddingHorizontal: 16, paddingVertical: 8 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#ff6b00' },
  runStatusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#181818', borderBottomWidth: 1, borderBottomColor: '#282828' },
  runStatusText: { color: '#ff6b00', fontSize: 13, fontWeight: '500', flex: 1 },
  queueBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#1a1408', borderBottomWidth: 1, borderBottomColor: '#2d2d2d' },
  queueText: { color: '#ffb829', fontSize: 12, fontWeight: '500' },
  approvalCard: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#6b4e00', backgroundColor: '#241a05' },
  approvalTitle: { color: '#ffd27a', fontWeight: '700', fontSize: 13, marginBottom: 4 },
  approvalCommand: { color: '#e8e8e8', fontFamily: 'monospace', fontSize: 12, marginTop: 6, backgroundColor: '#0a0a0a', borderRadius: 8, padding: 8 },
  approvalDescription: { color: '#bdbdbd', fontSize: 12, marginTop: 4 },
  approvalButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  approvalBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#ff6b00' },
  approvalBtnDeny: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#7f1d1d' },
  approvalBtnText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  approvalError: { color: '#fca5a5', fontSize: 12, marginTop: 6 },
  liveToolRow: { marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: '#101010', borderWidth: 1, borderColor: '#282828' },
  liveToolHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveToolName: { color: '#d4d4d4', fontFamily: 'monospace', fontSize: 12, flex: 1 },
  liveToolResult: { color: '#9a9a9a', fontFamily: 'monospace', fontSize: 11, marginTop: 4, maxHeight: 80 },
  liveStatus: { color: '#9a9a9a', fontSize: 13, marginTop: 6 },
  liveCursor: { color: '#8052ff', fontSize: 15 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  elapsed: { color: '#757575', fontSize: 12, marginLeft: 4 },
})

export default function ChatScreen() {
  const params = useLocalSearchParams<{ conversationId?: string }>()
  const { user } = useAuth()

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [liveText, setLiveText] = useState('')
  const [liveTools, setLiveTools] = useState<ToolActivity[]>([])
  const [liveStatus, setLiveStatus] = useState<string | null>(null)
  const [approval, setApproval] = useState<ApprovalCard | null>(null)
  const [approvalBusy, setApprovalBusy] = useState(false)
  const [approvalError, setApprovalError] = useState<string | null>(null)
  const [queuedCount, setQueuedCount] = useState(0)
  const [connection, setConnection] = useState<ConnectionState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [showConversationPicker, setShowConversationPicker] = useState(false)

  const scrollRef = useRef<ScrollView>(null)
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
    currentConversationRef.current = currentConversation
  }, [currentConversation])

  useEffect(() => {
    runRef.current = run
  }, [run])

  useEffect(() => {
    if (currentConversation?.id) {
      openedConversationRef.current = currentConversation.id
    }
  }, [currentConversation?.id])

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
      const record = data?.items?.[0] as Approval | undefined
      if (record) setApproval(approvalFromRecord(record))
    } catch {
      // Live event is the primary path.
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
    async (runId: string, status: string, result?: string | null, error?: string | null) => {
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
      // The run is over, so any pending approval is no longer actionable.
      setApproval(null)
      setApprovalError(null)
      setRun((previous) =>
        previous && previous.id === runId
          ? {
              ...previous,
              status: status as Run['status'],
              completed_at: new Date().toISOString(),
              result_summary: result ?? previous.result_summary,
              error: error ?? null,
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
            setMessages(messageData.items as Message[])
            setLiveText('')
            setLiveTools([])
            attachRun(activeRun as Run)
            const queued = (await api.listRuns({
              conversation_id: conversationId,
              status: 'queued',
              page_size: 50,
            })) as Run[]
            if (mountedRef.current && finishTokenRef.current === token) {
              setQueuedCount(queued.length)
            }
            return
          }
          if (!activeRun) {
            setMessages(messageData.items as Message[])
            setLiveText('')
            setLiveTools([])
            const queued = (await api.listRuns({
              conversation_id: conversationId,
              status: 'queued',
              page_size: 50,
            })) as Run[]
            if (mountedRef.current && finishTokenRef.current === token) {
              setQueuedCount(queued.length)
            }
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
          setMessages(messageData.items as Message[])
          setLiveText('')
          setLiveTools([])
        }
      } catch {
        // Keep live text as a fallback.
      }
    },
    [attachRun],
  )

  const handleEvent = (event: RunEvent) => {
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
        setRun((previous) => (previous ? { ...previous, status: 'running' } : previous))
        setLiveStatus('Conectando ao agente…')
        break

      case 'message_start':
        setLiveStatus(null)
        break

      case 'token':
        if (typeof data.delta === 'string' && data.delta) {
          setLiveText((previous) => previous + data.delta)
          setLiveStatus(null)
        }
        break

      case 'reasoning':
        setLiveStatus('Raciocinando…')
        break

      case 'status':
        if (typeof data.text === 'string' && data.text) setLiveStatus(data.text)
        break

      case 'title': {
        const title = typeof data.title === 'string' ? data.title : ''
        if (!title) break
        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === (data.conversation_id || wsRef.current.conversationId)
              ? { ...conversation, title }
              : conversation,
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
        break
      }

      case 'approval_resolved':
        setApproval(null)
        setRun((previous) => (previous ? { ...previous, status: 'running' } : previous))
        setLiveStatus('Aprovação enviada')
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
        if (!data.active || TERMINAL_STATUSES.includes(status)) {
          void finishRun(
            eventRunId,
            TERMINAL_STATUSES.includes(status) ? status : 'failed',
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
  }

  useEffect(() => {
    handleEventRef.current = handleEvent
  })

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.listConversations({ page_size: 100 })
      if (mountedRef.current) setConversations(data.items as Conversation[])
    } catch (error: any) {
      if (mountedRef.current) {
        Alert.alert('Erro', error?.response?.data?.detail || 'Erro ao carregar conversas')
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      closeWs()
    }
  }, [closeWs])

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
      resetRunState()
      setCurrentConversation(conversation)
      currentConversationRef.current = conversation
      setMessages([])

      try {
        const [messageData, activeRun, queued] = await Promise.all([
          api.listMessages(conversation.id, { page_size: 200 }),
          api.getActiveRun(conversation.id),
          api.listRuns({ conversation_id: conversation.id, status: 'queued', page_size: 50 }),
        ])
        if (!mountedRef.current) return
        setMessages(messageData.items as Message[])
        setQueuedCount((queued as Run[]).length)
        if (activeRun) attachRun(activeRun as Run)
      } catch (error: any) {
        if (mountedRef.current) {
          Alert.alert('Erro', error?.response?.data?.detail || 'Erro ao carregar conversa')
        }
      }
    },
    [attachRun, resetRunState],
  )

  // Deep link support: ?conversationId=...
  useEffect(() => {
    const id = params.conversationId
    if (!id || openedConversationRef.current === id) return
    const known = conversations.find((conversation) => conversation.id === id)
    if (known) {
      openedConversationRef.current = id
      void openConversation(known)
      return
    }
    openedConversationRef.current = id
    api
      .getConversation(id)
      .then((conversation: Conversation) => {
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
      })
  }, [params.conversationId, conversations, openConversation])

  useEffect(() => {
    if (messages.length > 0 || liveText) {
      scrollRef.current?.scrollToEnd({ animated: true })
    }
  }, [messages, liveText, liveTools, approval])

  useEffect(() => {
    if (!runActive) {
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

  const handleNewChat = () => {
    resetRunState()
    setCurrentConversation(null)
    currentConversationRef.current = null
    openedConversationRef.current = null
    setMessages([])
    setInputValue('')
    setShowConversationPicker(false)
  }

  const selectConversation = (conversation: Conversation) => {
    openedConversationRef.current = conversation.id
    setShowConversationPicker(false)
    void openConversation(conversation)
  }

  const sendMessage = async (content: string) => {
    const text = content.trim()
    if (!text || sending) return

    setSending(true)
    let conversation = currentConversationRef.current
    const wasActive = Boolean(runRef.current && isActive(runRef.current.status))
    const tempId = `temp_${Date.now()}`

    try {
      if (!conversation) {
        const created = (await api.createConversation({})) as Conversation
        conversation = { ...created, message_count: 0 }
        setConversations((previous) => [conversation!, ...previous])
        setCurrentConversation(conversation)
        currentConversationRef.current = conversation
        openedConversationRef.current = conversation.id
      }

      setMessages((previous) => [
        ...previous,
        {
          id: tempId,
          conversation_id: conversation!.id,
          role: 'user',
          content: text,
          created_at: new Date().toISOString(),
          run_id: null,
        } as Message,
      ])
      setInputValue('')

      if (!conversation.title) {
        const title = text.slice(0, 80)
        conversation = { ...conversation, title }
        setCurrentConversation(conversation)
        currentConversationRef.current = conversation
        setConversations((previous) =>
          previous.map((item) => (item.id === conversation!.id ? { ...item, title } : item)),
        )
      }

      const newRun = (await api.createRun(conversation.id, { message: text })) as Run
      if (wasActive) {
        setQueuedCount((previous) => previous + 1)
        setLiveStatus('Mensagem na fila do agente')
      } else {
        attachRun(newRun)
      }

      const messageData = await api.listMessages(conversation.id, { page_size: 200 })
      if (mountedRef.current) setMessages(messageData.items as Message[])
    } catch (error: any) {
      if (mountedRef.current) {
        setMessages((previous) => previous.filter((message) => message.id !== tempId))
        Alert.alert('Erro', error?.response?.data?.detail || 'Erro ao enviar mensagem')
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
    } catch (error: any) {
      Alert.alert('Erro', error?.response?.data?.detail || 'Erro ao parar execução')
      setLiveStatus(null)
    }
  }

  const resolveApproval = async (choice: string) => {
    if (!approval || approvalBusy) return
    setApprovalBusy(true)
    setApprovalError(null)
    try {
      if (choice === 'deny') await api.deny(approval.approval_id, choice)
      else await api.approve(approval.approval_id, choice)
      setApproval(null)
      setLiveStatus('Aprovação enviada')
    } catch (error: any) {
      setApprovalError(error?.response?.data?.detail || 'Falha ao responder ao Hermes')
    } finally {
      if (mountedRef.current) setApprovalBusy(false)
    }
  }

  const renderMessage = (message: Message) => {
    const isUser = message.role === 'user'
    const tools = message.role === 'assistant' ? mergedTools(message) : []

    if (message.role === 'assistant' && !message.content.trim() && tools.length === 0) {
      return null
    }

    return (
      <View key={message.id} style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        {tools.map((tool) => (
          <View key={tool.call_id} style={styles.liveToolRow}>
            <View style={styles.liveToolHeader}>
              <Ionicons
                name={tool.is_error ? 'close-circle' : 'terminal'}
                size={14}
                color={tool.is_error ? '#ef4444' : '#ff6b00'}
              />
              <Text style={styles.liveToolName}>{tool.tool}</Text>
              {typeof tool.duration_s === 'number' && (
                <Text style={styles.liveStatus}>{tool.duration_s.toFixed(1)}s</Text>
              )}
            </View>
            {tool.result ? <Text style={styles.liveToolResult} numberOfLines={6}>{tool.result}</Text> : null}
          </View>
        ))}
        {message.content ? <Text style={styles.messageText}>{message.content}</Text> : null}
      </View>
    )
  }

  if (loading && conversations.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ff6b00" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {currentConversation?.title || 'ODIN V2'}
          </Text>
          {user?.email ? (
            <Text style={{ color: '#686868', fontSize: 11 }} numberOfLines={1}>
              {user.email}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => setShowConversationPicker(true)}
          style={styles.newChatBtn}
          accessibilityLabel="Conversas"
        >
          <Ionicons name="chatbubbles-outline" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNewChat} style={styles.newChatBtn}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.newChatBtnText}>Nova</Text>
        </TouchableOpacity>
      </View>

      {run && isActive(run.status) && (
        <View style={styles.runStatusBar}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor:
                  connection === 'live' ? '#15846e' : connection === 'reconnecting' ? '#ffb829' : '#8052ff',
              },
            ]}
          />
          <Text style={styles.runStatusText} numberOfLines={1}>
            {runLabel(run, liveStatus, connection)}
          </Text>
          <Text style={styles.elapsed}>{elapsed}s</Text>
          <TouchableOpacity onPress={stopRun} style={styles.stopBtn} accessibilityLabel="Parar execução">
            <Ionicons name="square" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {queuedCount > 0 && (
        <View style={styles.queueBar}>
          <Ionicons name="time" size={14} color="#ffb829" />
          <Text style={styles.queueText}>
            {queuedCount} mensagem{queuedCount > 1 ? 's' : ''} na fila
          </Text>
        </View>
      )}

      {approval && (
        <View style={styles.approvalCard}>
          <Text style={styles.approvalTitle}>Aprovação necessária · {approval.operation}</Text>
          {approval.description ? (
            <Text style={styles.approvalDescription}>{approval.description}</Text>
          ) : null}
          {approval.command ? (
            <Text style={styles.approvalCommand} numberOfLines={8}>
              {approval.command}
            </Text>
          ) : null}
          {approvalError ? <Text style={styles.approvalError}>{approvalError}</Text> : null}
          <View style={styles.approvalButtons}>
            {approval.choices.map((choice) => (
              <TouchableOpacity
                key={choice}
                onPress={() => resolveApproval(choice)}
                disabled={approvalBusy}
                style={choice === 'deny' ? styles.approvalBtnDeny : styles.approvalBtn}
              >
                <Text style={styles.approvalBtnText}>
                  {approvalBusy ? '…' : choiceLabel(choice)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && !currentConversation && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color="#282828" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Bem-vindo ao ODIN V2</Text>
            <Text style={styles.emptySubtitle}>
              Converse com o Hermes em tempo real, com ferramentas e aprovações inline
            </Text>
          </View>
        )}

        {messages.length === 0 && currentConversation && !runActive && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color="#282828" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Nenhuma mensagem</Text>
            <Text style={styles.emptySubtitle}>Envie a primeira mensagem para começar</Text>
          </View>
        )}

        {messages.map(renderMessage)}

        {runActive && (
          <View style={[styles.messageBubble, styles.assistantBubble]}>
            {liveTools.map((tool) => (
              <View key={tool.call_id} style={styles.liveToolRow}>
                <View style={styles.liveToolHeader}>
                  {tool.status === 'running' ? (
                    <ActivityIndicator size="small" color="#ff6b00" />
                  ) : (
                    <Ionicons
                      name={tool.is_error ? 'close-circle' : 'checkmark-circle'}
                      size={14}
                      color={tool.is_error ? '#ef4444' : '#15846e'}
                    />
                  )}
                  <Text style={styles.liveToolName}>{tool.tool}</Text>
                </View>
                {tool.result ? (
                  <Text style={styles.liveToolResult} numberOfLines={5}>
                    {tool.result}
                  </Text>
                ) : null}
              </View>
            ))}

            {liveText ? (
              <Text style={styles.messageText}>
                {liveText}
                <Text style={styles.liveCursor}> ▍</Text>
              </Text>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator size="small" color="#ff6b00" />
                <Text style={styles.liveStatus}>{liveStatus || 'Pensando…'}</Text>
              </View>
            )}

            {liveText && liveStatus ? <Text style={styles.liveStatus}>{liveStatus}</Text> : null}
          </View>
        )}

        {run && !runActive && run.status === 'failed' && run.error ? (
          <View style={[styles.messageBubble, styles.assistantBubble, { borderColor: '#7f1d1d' }]}>
            <Text style={{ color: '#fca5a5', fontSize: 13 }}>{run.error}</Text>
          </View>
        ) : null}
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inputContainer}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={runActive ? 'Enviar outra mensagem — entra na fila…' : 'Digite sua mensagem...'}
            placeholderTextColor="#686868"
            multiline
            maxLength={4000}
            editable={!sending}
            onSubmitEditing={() => sendMessage(inputValue)}
          />
          <TouchableOpacity
            onPress={() => sendMessage(inputValue)}
            style={[styles.sendBtn, (!inputValue.trim() || sending) && { opacity: 0.5 }]}
            disabled={!inputValue.trim() || sending}
            accessibilityLabel="Enviar mensagem"
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {showConversationPicker && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            onPress={() => setShowConversationPicker(false)}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              backgroundColor: '#0a0a0a',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: 420,
            }}
          >
            <View
              style={{
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: '#282828',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>Conversas</Text>
              <TouchableOpacity onPress={() => setShowConversationPicker(false)}>
                <Ionicons name="close" size={24} color="#686868" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                <TouchableOpacity
                  onPress={handleNewChat}
                  style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#181818' }}
                >
                  <Text style={{ color: '#ff6b00', fontSize: 16, fontWeight: '600' }}>
                    + Nova conversa
                  </Text>
                </TouchableOpacity>
              }
              ListEmptyComponent={
                <Text style={{ color: '#686868', padding: 16 }}>Nenhuma conversa ainda.</Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => selectConversation(item)}
                  style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#181818' }}
                >
                  <Text style={{ color: '#fff', fontSize: 16 }}>
                    {item.title || `Conversa ${item.id.slice(0, 8)}`}
                  </Text>
                  <Text style={{ color: '#686868', fontSize: 12, marginTop: 4 }}>
                    {item.message_count} mensagens
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}
