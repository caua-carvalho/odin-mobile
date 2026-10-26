import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import * as SecureStore from 'expo-secure-store'

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://127.0.0.1:8000/api'

const ACCESS_TOKEN_KEY = 'odin_access_token'

class ApiClient {
  private client: AxiosInstance
  private accessToken: string | null = null
  private refreshPromise: Promise<string> | null = null

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    })

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken && config.headers) {
          config.headers.Authorization = `Bearer ${this.accessToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            const newToken = await this.refreshToken()
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
            }
            return this.client(originalRequest)
          } catch {
            await this.clearToken()
            return Promise.reject(error)
          }
        }

        return Promise.reject(error)
      }
    )
  }

  async initialize() {
    this.accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY)
  }

  setToken(token: string | null) {
    this.accessToken = token
    if (token) {
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token)
    } else {
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
    }
  }

  getToken(): string | null {
    return this.accessToken
  }

  async clearToken() {
    this.accessToken = null
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY)
  }

  private async refreshToken(): Promise<string> {
    if (this.refreshPromise) {
      return this.refreshPromise
    }

    this.refreshPromise = (async () => {
      const response = await axios.post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
      const { access_token } = response.data
      this.setToken(access_token)
      return access_token
    })()

    try {
      return await this.refreshPromise
    } finally {
      this.refreshPromise = null
    }
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password })
    const { access_token } = response.data
    this.setToken(access_token)
    return response.data
  }

  async logout() {
    await this.client.post('/auth/logout')
    await this.clearToken()
  }

  async getMe(): Promise<User> {
    const response = await this.client.get('/auth/me')
    return response.data
  }

  // Conversations
  async listConversations(params?: { page?: number; page_size?: number }) {
    const response = await this.client.get('/conversations', { params })
    return response.data
  }

  async createConversation(data: { title?: string; initial_message?: string }) {
    const response = await this.client.post('/conversations', data)
    return response.data
  }

  async getConversation(id: string) {
    const response = await this.client.get(`/conversations/${id}`)
    return response.data
  }

  async updateConversation(id: string, data: { title?: string }) {
    const response = await this.client.patch(`/conversations/${id}`, data)
    return response.data
  }

  async deleteConversation(id: string) {
    await this.client.delete(`/conversations/${id}`)
  }

  async listMessages(conversationId: string, params?: { page?: number; page_size?: number }) {
    const response = await this.client.get(`/conversations/${conversationId}/messages`, { params })
    return response.data
  }

  // Runs
  async createRun(conversationId: string, data: { message: string; stream?: boolean }) {
    const response = await this.client.post(`/conversations/${conversationId}/runs`, {
      message: data.message,
    })
    return response.data
  }

  async getRun(id: string) {
    const response = await this.client.get(`/runs/${id}`)
    return response.data
  }

  async getActiveRun(conversationId: string): Promise<Run | null> {
    const response = await this.client.get(`/conversations/${conversationId}/runs/active`)
    return response.data
  }

  async listRuns(params?: { conversation_id?: string; status?: string; page?: number; page_size?: number }) {
    const response = await this.client.get('/runs', { params })
    return response.data
  }

  async stopRun(id: string) {
    const response = await this.client.post(`/runs/${id}/stop`)
    return response.data
  }

  createRunWebSocketUrl(runId: string, after = 0): string {
    const wsBase = API_BASE.replace(/^http/, 'ws').replace(/\/$/, '')
    const token = this.getToken() || ''
    const query = new URLSearchParams({ after: String(after) })
    if (token) query.set('token', token)
    return `${wsBase}/runs/${runId}/ws?${query.toString()}`
  }

  // Approvals
  async listApprovals(status?: string, runId?: string) {
    const response = await this.client.get('/approvals', { params: { status, run_id: runId } })
    return response.data
  }

  async approve(approvalId: string, choice?: string) {
    const response = await this.client.post(`/approvals/${approvalId}/approve`, null, {
      params: choice ? { choice } : undefined,
    })
    return response.data
  }

  async deny(approvalId: string, choice?: string) {
    const response = await this.client.post(`/approvals/${approvalId}/deny`, null, {
      params: choice ? { choice } : undefined,
    })
    return response.data
  }

  // Knowledge
  async listKnowledge(params?: { type?: string; tags?: string; q?: string; page?: number; page_size?: number }) {
    const response = await this.client.get('/knowledge', { params })
    return response.data
  }

  async createKnowledge(data: { type: string; title: string; content: string; url?: string; tags?: string[] }) {
    const response = await this.client.post('/knowledge', data)
    return response.data
  }

  async getKnowledge(id: string) {
    const response = await this.client.get(`/knowledge/${id}`)
    return response.data
  }

  async updateKnowledge(id: string, data: Partial<{ title: string; content: string; url?: string; tags?: string[] }>) {
    const response = await this.client.patch(`/knowledge/${id}`, data)
    return response.data
  }

  async deleteKnowledge(id: string) {
    await this.client.delete(`/knowledge/${id}`)
  }

  // System
  async getSystemStatus() {
    const response = await this.client.get('/system/status')
    return response.data
  }

  async healthCheck() {
    const response = await this.client.get('/health')
    return response.data
  }
}

export const api = new ApiClient()

// Types
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

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: any[]
  tool_results?: any[]
  run_id: string | null
  created_at: string
}

export interface Run {
  id: string
  conversation_id: string
  hermes_run_id: string | null
  hermes_session_id: string | null
  status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' | 'interrupted'
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

export interface SystemStatus {
  version: string
  overall: 'ok' | 'degraded'
  components: Record<string, { status: string; details?: Record<string, any> }>
  hermes_connected: boolean
  database_connected: boolean
  timestamp: string
}