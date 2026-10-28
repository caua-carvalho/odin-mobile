import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'
import {
  clearStoredServerUrl,
  defaultServerUrl,
  isServerExplicitlyConfigured,
  loadStoredServerUrl,
  normalizeServerUrl,
  saveStoredServerUrl,
} from './serverConfig'

const ACCESS_TOKEN_KEY = 'odin_access_token'
const REFRESH_TOKEN_KEY = 'odin_refresh_token'
const MOBILE_CLIENT_HEADER = 'X-Odin-Client'
const MOBILE_CLIENT_ID = 'mobile'

let apiBase = defaultServerUrl()
let serverConfigured = isServerExplicitlyConfigured()

/** Current API base, kept in sync with the value persisted in SecureStore. */
export function getApiBase(): string {
  return apiBase
}

/** False on a fresh standalone install until a server is saved. */
export function isServerConfigured(): boolean {
  return serverConfigured
}

export class ApiClient {
  private client: AxiosInstance
  private accessToken: string | null = null
  private refreshTokenValue: string | null = null
  private refreshPromise: Promise<string> | null = null
  private unauthorizedHandler: (() => void) | null = null

  constructor() {
    this.client = axios.create({
      baseURL: apiBase,
      headers: {
        'Content-Type': 'application/json',
        [MOBILE_CLIENT_HEADER]: MOBILE_CLIENT_ID,
      },
      withCredentials: false,
      timeout: 30_000,
    })

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.accessToken}`
        }
        if (config.headers) {
          config.headers[MOBILE_CLIENT_HEADER] = MOBILE_CLIENT_ID
        }
        return config
      },
      (error) => Promise.reject(error),
    )

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as
          | (InternalAxiosRequestConfig & { _retry?: boolean })
          | undefined
        const status = error.response?.status
        const url = originalRequest?.url ?? ''
        const isAuthCall = url.includes('/auth/login') || url.includes('/auth/refresh')

        if (status === 401 && originalRequest && !originalRequest._retry && !isAuthCall) {
          originalRequest._retry = true
          try {
            const newToken = await this.refreshAccessToken()
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
            }
            return this.client(originalRequest)
          } catch {
            await this.clearTokens()
            this.unauthorizedHandler?.()
            return Promise.reject(error)
          }
        }

        if (status === 401 && !isAuthCall) {
          this.unauthorizedHandler?.()
        }

        return Promise.reject(error)
      },
    )
  }

  setUnauthorizedHandler(handler: (() => void) | null) {
    this.unauthorizedHandler = handler
  }

  async initialize() {
    const stored = await loadStoredServerUrl()
    if (stored) {
      apiBase = stored
      serverConfigured = true
      this.client.defaults.baseURL = stored
    }

    const [access, refresh] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY).catch(() => null),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY).catch(() => null),
    ])
    this.accessToken = access
    this.refreshTokenValue = refresh
  }

  /**
   * Persist a new backend address and point the axios instance at it.
   * Changing servers invalidates tokens issued by the previous node.
   */
  async setServerUrl(value: string): Promise<string> {
    const normalized = normalizeServerUrl(value)
    if (!normalized) {
      throw new Error('Endereço inválido. Use, por exemplo, http://192.168.1.50:8000/api')
    }

    const changed = normalized !== apiBase
    apiBase = normalized
    serverConfigured = true
    this.client.defaults.baseURL = normalized
    await saveStoredServerUrl(normalized)
    if (changed) await this.clearTokens()
    return normalized
  }

  /** Drop the custom server and return to the environment default. */
  async resetServerUrl(): Promise<string> {
    await clearStoredServerUrl()
    apiBase = defaultServerUrl()
    serverConfigured = isServerExplicitlyConfigured()
    this.client.defaults.baseURL = apiBase
    await this.clearTokens()
    return apiBase
  }

  getToken(): string | null {
    return this.accessToken
  }

  getRefreshToken(): string | null {
    return this.refreshTokenValue
  }

  private async persistTokens(access: string, refresh?: string | null) {
    this.accessToken = access
    if (refresh) this.refreshTokenValue = refresh
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access).catch(() => undefined),
      refresh
        ? SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh).catch(() => undefined)
        : Promise.resolve(),
    ])
  }

  async clearTokens() {
    this.accessToken = null
    this.refreshTokenValue = null
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY).catch(() => undefined),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY).catch(() => undefined),
    ])
  }

  private async refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise
    if (!this.refreshTokenValue) throw new Error('Sessão expirada. Entre novamente.')

    this.refreshPromise = (async () => {
      const response = await axios.post<LoginResponse>(
        `${getApiBase()}/auth/refresh`,
        { refresh_token: this.refreshTokenValue },
        {
          headers: {
            'Content-Type': 'application/json',
            [MOBILE_CLIENT_HEADER]: MOBILE_CLIENT_ID,
          },
          timeout: 20_000,
        },
      )
      const data = response.data
      await this.persistTokens(data.access_token, data.refresh_token ?? this.refreshTokenValue)
      return data.access_token
    })()

    try {
      return await this.refreshPromise
    } finally {
      this.refreshPromise = null
    }
  }

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.client.post<LoginResponse>('/auth/login', { email, password })
    await this.persistTokens(response.data.access_token, response.data.refresh_token)
    return response.data
  }

  async logout(): Promise<void> {
    try {
      await this.client.post(
        '/auth/logout',
        this.refreshTokenValue ? { refresh_token: this.refreshTokenValue } : undefined,
      )
    } catch {
      // Local session is cleared regardless of network/server state.
    } finally {
      await this.clearTokens()
    }
  }

  async getMe(): Promise<User> {
    const response = await this.client.get<User>('/auth/me')
    return response.data
  }

  // ---------------------------------------------------------------------------
  // Conversations
  // ---------------------------------------------------------------------------

  async listConversations(params?: { page?: number; page_size?: number }) {
    const response = await this.client.get<ConversationListResponse>('/conversations', { params })
    return response.data
  }

  async createConversation(data: { title?: string; initial_message?: string }) {
    const response = await this.client.post<Conversation>('/conversations', data)
    return response.data
  }

  async getConversation(id: string) {
    const response = await this.client.get<Conversation>(`/conversations/${id}`)
    return response.data
  }

  async updateConversation(id: string, data: { title?: string }) {
    const response = await this.client.patch<Conversation>(`/conversations/${id}`, data)
    return response.data
  }

  async deleteConversation(id: string) {
    await this.client.delete(`/conversations/${id}`)
  }

  async listMessages(conversationId: string, params?: { page?: number; page_size?: number }) {
    const response = await this.client.get<MessageListResponse>(
      `/conversations/${conversationId}/messages`,
      { params },
    )
    return response.data
  }

  // ---------------------------------------------------------------------------
  // Runs
  // ---------------------------------------------------------------------------

  async createRun(conversationId: string, data: { message: string; stream?: boolean }) {
    const response = await this.client.post<Run>(`/conversations/${conversationId}/runs`, {
      message: data.message,
    })
    return response.data
  }

  async getRun(id: string) {
    const response = await this.client.get<Run>(`/runs/${id}`)
    return response.data
  }

  async getActiveRun(conversationId: string): Promise<Run | null> {
    const response = await this.client.get<Run | null>(`/conversations/${conversationId}/runs/active`)
    return response.data
  }

  async listRuns(params?: {
    conversation_id?: string
    status?: string
    page?: number
    page_size?: number
  }) {
    const response = await this.client.get<Run[]>('/runs', { params })
    return response.data
  }

  async stopRun(id: string) {
    const response = await this.client.post<{ ok: boolean; run_id: string; status: string }>(
      `/runs/${id}/stop`,
    )
    return response.data
  }

  createRunWebSocketUrl(runId: string, after = 0): string {
    const wsBase = getApiBase().replace(/^http/, 'ws').replace(/\/$/, '')
    const token = this.getToken() || ''
    const query = new URLSearchParams({ after: String(after) })
    if (token) query.set('token', token)
    return `${wsBase}/runs/${runId}/ws?${query.toString()}`
  }

  // ---------------------------------------------------------------------------
  // Approvals
  // ---------------------------------------------------------------------------

  async listApprovals(status?: string, runId?: string) {
    const response = await this.client.get<ApprovalListResponse>('/approvals', {
      params: { status, run_id: runId },
    })
    return response.data
  }

  async approve(approvalId: string, choice?: string) {
    const response = await this.client.post<ApprovalActionResponse>(
      `/approvals/${approvalId}/approve`,
      null,
      { params: choice ? { choice } : undefined },
    )
    return response.data
  }

  async deny(approvalId: string, choice?: string) {
    const response = await this.client.post<ApprovalActionResponse>(
      `/approvals/${approvalId}/deny`,
      null,
      { params: choice ? { choice } : undefined },
    )
    return response.data
  }

  // ---------------------------------------------------------------------------
  // Knowledge
  // ---------------------------------------------------------------------------

  async listKnowledge(params?: {
    type?: string
    tags?: string
    q?: string
    page?: number
    page_size?: number
  }) {
    const response = await this.client.get<KnowledgeListResponse>('/knowledge', { params })
    return response.data
  }

  async createKnowledge(data: {
    type: string
    title: string
    content: string
    url?: string
    tags?: string[]
  }) {
    const response = await this.client.post<KnowledgeItem>('/knowledge', data)
    return response.data
  }

  async getKnowledge(id: string) {
    const response = await this.client.get<KnowledgeItem>(`/knowledge/${id}`)
    return response.data
  }

  async updateKnowledge(
    id: string,
    data: Partial<{ title: string; content: string; url?: string; tags?: string[] }>,
  ) {
    const response = await this.client.patch<KnowledgeItem>(`/knowledge/${id}`, data)
    return response.data
  }

  async deleteKnowledge(id: string) {
    await this.client.delete(`/knowledge/${id}`)
  }

  // ---------------------------------------------------------------------------
  // System
  // ---------------------------------------------------------------------------

  async getSystemStatus() {
    const response = await this.client.get<SystemStatus>('/system/status')
    return response.data
  }

  async healthCheck() {
    const response = await this.client.get<{ ok: boolean; version: string; timestamp: string }>('/health')
    return response.data
  }
}

export const api = new ApiClient()

// -----------------------------------------------------------------------------
// Types (aligned with backend/app/schemas)
// -----------------------------------------------------------------------------

export interface LoginResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string | null
}

export interface User {
  id: string
  email: string
  is_active: boolean
  is_superuser: boolean
  created_at: string
  last_login?: string | null
}

export interface Conversation {
  id: string
  title: string | null
  hermes_session_id: string | null
  created_at: string
  updated_at: string
  message_count: number
}

export interface ConversationListResponse {
  items: Conversation[]
  total: number
  page: number
  page_size: number
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: Array<Record<string, any>>
  tool_results?: Array<Record<string, any>>
  run_id: string | null
  created_at: string
  updated_at?: string | null
}

export interface MessageListResponse {
  items: Message[]
  total: number
  page: number
  page_size: number
}

export type RunStatus =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'interrupted'

export interface Run {
  id: string
  conversation_id: string
  hermes_run_id: string | null
  hermes_session_id: string | null
  status: RunStatus
  started_at: string
  completed_at: string | null
  result_summary: string | null
  error: string | null
  events: RunEvent[]
  queue_position?: number
}

export interface RunEvent {
  type: string
  data: Record<string, any>
  timestamp: string
  run_id?: string
  seq?: number
}

export interface Approval {
  id: string
  run_id: string
  hermes_approval_id: string | null
  operation: string
  details: Record<string, any>
  status: 'pending' | 'approved' | 'denied' | 'expired'
  created_at: string
  resolved_at: string | null
  expires_at: string | null
}

export interface ApprovalListResponse {
  items: Approval[]
}

export interface ApprovalActionResponse {
  ok: boolean
  approval_id: string
  status: string
}

export interface KnowledgeItem {
  id: string
  type: 'note' | 'link' | 'snippet' | 'personal'
  title: string
  content: string
  url: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface KnowledgeListResponse {
  items: KnowledgeItem[]
  total: number
  page: number
  page_size: number
}

export interface SystemStatus {
  version: string
  overall: 'ok' | 'degraded'
  components: Record<string, { status: string; details?: Record<string, any> }>
  hermes_connected: boolean
  database_connected: boolean
  timestamp: string
}
