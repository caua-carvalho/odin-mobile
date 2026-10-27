import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { AgentOrb, type AgentOrbState } from '../../components/orb/AgentOrb'
import { HudScreen } from '../../components/hud/Screen'
import { ScreenHeader } from '../../components/hud/ScreenHeader'
import {
  Badge,
  EmptyState,
  Panel,
  PressableScale,
  SectionLabel,
  StatTile,
} from '../../components/hud/primitives'
import { api, type Conversation, type Run, type SystemStatus } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { useOdinStatus } from '../../contexts/OdinStatusContext'
import { alpha, colors, fonts, radius, spacing } from '../../lib/theme'
import { formatRelativeTime, getErrorMessage, pluralize } from '../../lib/utils'

const SUGGESTIONS = [
  'Status geral da infraestrutura e diagnóstico dos agentes',
  'Listar tarefas pendentes e sincronizações programadas',
  'Quais arquivos e notas estão indexados na biblioteca?',
]

const RUN_TONE: Record<string, { label: string; tone: 'primary' | 'cyan' | 'success' | 'warning' | 'danger' | 'neutral' }> = {
  queued: { label: 'Na fila', tone: 'neutral' },
  running: { label: 'Executando', tone: 'primary' },
  waiting_approval: { label: 'Aprovação', tone: 'warning' },
  completed: { label: 'Concluída', tone: 'success' },
  failed: { label: 'Falhou', tone: 'danger' },
  cancelled: { label: 'Cancelada', tone: 'neutral' },
  interrupted: { label: 'Interrompida', tone: 'neutral' },
}

export default function NexusScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const {
    pendingApprovals,
    activeRuns,
    conversationTotal,
    lastUpdated,
    refresh: refreshStatus,
  } = useOdinStatus()

  const [prompt, setPrompt] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [recentRuns, setRecentRuns] = useState<Run[]>([])
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)

  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadLocalData = useCallback(async () => {
    const [conversationsResult, runsResult, statusResult] = await Promise.allSettled([
      api.listConversations({ page_size: 5 }),
      api.listRuns({ page_size: 5 }),
      api.getSystemStatus(),
    ])
    if (!mounted.current) return
    if (conversationsResult.status === 'fulfilled') {
      setConversations(conversationsResult.value.items)
    }
    if (runsResult.status === 'fulfilled') {
      setRecentRuns(runsResult.value)
    }
    if (statusResult.status === 'fulfilled') {
      setSystemStatus(statusResult.value)
    }
  }, [])

  useEffect(() => {
    // Initial fetch plus polling; data lands after the awaited requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadLocalData()
    const timer = setInterval(() => {
      void loadLocalData()
    }, 30_000)
    return () => clearInterval(timer)
  }, [loadLocalData])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.allSettled([refreshStatus(), loadLocalData()])
    if (mounted.current) setRefreshing(false)
  }, [loadLocalData, refreshStatus])

  const activeRun = activeRuns[0] ?? null
  const orbState: AgentOrbState = pendingApprovals.length > 0
    ? 'waiting_approval'
    : activeRun?.status === 'running'
      ? 'working'
      : activeRun?.status === 'queued'
        ? 'queued'
        : 'idle'

  const statusLine = pendingApprovals.length > 0
    ? `${pendingApprovals.length} ${pluralize(pendingApprovals.length, 'autorização pendente', 'autorizações pendentes')}`
    : activeRun?.status === 'running'
      ? 'Agente executando em segundo plano'
      : activeRun?.status === 'queued'
        ? 'Execuções na fila do agente'
        : 'Todos os sistemas operacionais e prontos'

  const dispatchCommand = useCallback(async () => {
    const text = prompt.trim()
    if (!text || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const conversation = await api.createConversation({ title: text.slice(0, 60) })
      await api.createRun(conversation.id, { message: text })
      setPrompt('')
      void refreshStatus()
      router.push({
        pathname: '/(tabs)/chat',
        params: { conversationId: conversation.id },
      })
    } catch (err) {
      setError(getErrorMessage(err, 'Falha ao transmitir o comando para o ODIN.'))
    } finally {
      if (mounted.current) setSubmitting(false)
    }
  }, [prompt, refreshStatus, router, submitting])

  const openConversation = useCallback(
    (conversationId: string) => {
      router.push({
        pathname: '/(tabs)/chat',
        params: { conversationId },
      })
    },
    [router],
  )

  const resolveApproval = useCallback(
    async (approvalId: string, decision: 'approve' | 'deny') => {
      try {
        if (decision === 'approve') await api.approve(approvalId)
        else await api.deny(approvalId)
        await refreshStatus()
      } catch (err) {
        Alert.alert('Falha', getErrorMessage(err, 'Não foi possível responder à autorização.'))
      }
    },
    [refreshStatus],
  )

  const hermesOnline = systemStatus?.hermes_connected
  const dbOnline = systemStatus?.database_connected
  const overallOk = systemStatus?.overall === 'ok'

  return (
    <HudScreen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void handleRefresh()}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.elevated}
        />
      }
      contentContainerStyle={styles.content}
    >
      <ScreenHeader
        eyebrow="Odin · Command Nexus"
        title={`Olá, ${user?.email?.split('@')[0] ?? 'operador'}.`}
        subtitle="Centro de comando do seu nó neural. Despache diretrizes, acompanhe execuções e valide protocolos."
        right={
          <Badge
            label={overallOk ? 'Online' : 'Degradado'}
            tone={overallOk ? 'success' : 'warning'}
            dot
          />
        }
      />

      {pendingApprovals.length > 0 ? (
        <Animated.View entering={FadeInDown.duration(380)} style={styles.section}>
          <Panel glow="orange" style={styles.alertPanel}>
            <View style={styles.alertRow}>
              <View style={styles.alertIcon}>
                <Ionicons name="shield-half-outline" size={19} color={colors.warningLight} />
              </View>
              <View style={styles.alertCopy}>
                <Text style={styles.alertTitle}>Protocolo de segurança ativo</Text>
                <Text style={styles.alertText}>
                  {pendingApprovals.length}{' '}
                  {pluralize(pendingApprovals.length, 'operação crítica aguarda', 'operações críticas aguardam')}{' '}
                  validação do operador.
                </Text>
              </View>
            </View>

            <View style={styles.approvalList}>
              {pendingApprovals.slice(0, 2).map((approval) => (
                <View key={approval.id} style={styles.approvalItem}>
                  <View style={styles.approvalInfo}>
                    <Text style={styles.approvalOperation} numberOfLines={1}>
                      {approval.operation}
                    </Text>
                    <Text style={styles.approvalMeta} numberOfLines={1}>
                      Run {approval.run_id.slice(0, 8)} · {formatRelativeTime(approval.created_at)}
                    </Text>
                  </View>
                  <View style={styles.approvalActions}>
                    <PressableScale
                      accessibilityLabel="Negar autorização"
                      haptic="light"
                      onPress={() => void resolveApproval(approval.id, 'deny')}
                      style={styles.approvalAction}
                    >
                      <Ionicons name="close" size={16} color={colors.dangerLight} />
                    </PressableScale>
                    <PressableScale
                      accessibilityLabel="Aprovar autorização"
                      haptic="medium"
                      onPress={() => void resolveApproval(approval.id, 'approve')}
                      style={[styles.approvalAction, styles.approvalActionPrimary]}
                    >
                      <Ionicons name="checkmark" size={16} color={colors.bg} />
                    </PressableScale>
                  </View>
                </View>
              ))}
            </View>
          </Panel>
        </Animated.View>
      ) : null}

      <Animated.View entering={FadeInUp.delay(60).duration(520)} style={styles.heroWrap}>
        <AgentOrb state={orbState} size={206} label="Núcleo ODIN" />
        <View style={styles.heroCopy}>
          <Text style={styles.heroEyebrow}>SISTEMA NEURAL ATIVO</Text>
          <Text style={styles.heroTitle}>ODIN COMMAND CORE</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusLine.includes('pendente') ? colors.warning : colors.primary }]} />
            <Text style={styles.statusText}>{statusLine}</Text>
          </View>
        </View>
      </Animated.View>

      <View style={styles.section}>
        <SectionLabel title="Diretriz rápida" right={<Text style={styles.sectionHint}>Enter para disparar</Text>} />
        <View style={styles.commandShell}>
          <Ionicons name="terminal-outline" size={19} color={colors.primary} />
          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Transmitir diretriz ou comando para o ODIN…"
            placeholderTextColor={colors.dim}
            multiline
            maxLength={4000}
            editable={!submitting}
            style={styles.commandInput}
            selectionColor={colors.primary}
            onSubmitEditing={() => void dispatchCommand()}
            blurOnSubmit={false}
          />
          <PressableScale
            accessibilityLabel="Enviar comando"
            haptic="medium"
            onPress={() => void dispatchCommand()}
            disabled={!prompt.trim() || submitting}
            style={[
              styles.sendButton,
              (!prompt.trim() || submitting) && styles.sendButtonDisabled,
            ]}
          >
            <Ionicons
              name={submitting ? 'sync' : 'arrow-up'}
              size={20}
              color={colors.bg}
            />
          </PressableScale>
        </View>
        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="warning-outline" size={14} color={colors.dangerLight} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        <StatTile label="Execuções" value={recentRuns.length} tone="primary" />
        <StatTile
          label="Aprovações"
          value={pendingApprovals.length}
          tone={pendingApprovals.length > 0 ? 'warning' : 'neutral'}
        />
        <StatTile label="Sessões" value={conversationTotal} tone="cyan" />
      </View>

      <View style={styles.section}>
        <SectionLabel
          title="Sessões recentes"
          right={
            <PressableScale
              accessibilityLabel="Abrir chat"
              haptic="none"
              onPress={() => router.push('/(tabs)/chat')}
            >
              <Text style={styles.linkText}>Abrir chat</Text>
            </PressableScale>
          }
        />
        <Panel padded={false}>
          {conversations.length === 0 ? (
            <EmptyState
              icon="chatbubbles-outline"
              title="Nenhuma sessão ainda"
              description="Despache uma diretriz acima para abrir seu primeiro canal com o Hermes."
            />
          ) : (
            conversations.slice(0, 4).map((conversation, index) => (
              <PressableScale
                key={conversation.id}
                accessibilityLabel={`Abrir ${conversation.title ?? 'conversa'}`}
                haptic="selection"
                onPress={() => openConversation(conversation.id)}
                style={styles.conversationPress}
              >
                <View
                  style={[
                    styles.conversationRow,
                    index > 0 && styles.conversationRowBorder,
                  ]}
                >
                  <View style={styles.conversationIcon}>
                    <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primaryLight} />
                  </View>
                  <View style={styles.conversationCopy}>
                    <Text style={styles.conversationTitle} numberOfLines={1}>
                      {conversation.title || `Sessão ${conversation.id.slice(0, 8)}`}
                    </Text>
                    <Text style={styles.conversationMeta}>
                      {conversation.message_count} {pluralize(conversation.message_count, 'mensagem', 'mensagens')} ·{' '}
                      {formatRelativeTime(conversation.updated_at)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                </View>
              </PressableScale>
            ))
          )}
        </Panel>
      </View>

      {recentRuns.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel
            title="Atividade recente"
            right={
              <PressableScale
                accessibilityLabel="Ver atividade"
                haptic="none"
                onPress={() => router.push('/(tabs)/activity')}
              >
                <Text style={styles.linkText}>Ver tudo</Text>
              </PressableScale>
            }
          />
          <Panel padded={false}>
            {recentRuns.slice(0, 4).map((run, index) => {
              const meta = RUN_TONE[run.status] ?? RUN_TONE.queued
              return (
                <PressableScale
                  key={run.id}
                  accessibilityLabel={`Abrir execução ${run.id.slice(0, 8)}`}
                  haptic="selection"
                  onPress={() => openConversation(run.conversation_id)}
                  style={styles.conversationPress}
                >
                  <View
                    style={[
                      styles.runRow,
                      index > 0 && styles.conversationRowBorder,
                    ]}
                  >
                    <View style={styles.runCopy}>
                      <Text style={styles.runTitle} numberOfLines={1}>
                        {run.result_summary || `Run ${run.id.slice(0, 8)}`}
                      </Text>
                      <Text style={styles.conversationMeta}>
                        {formatRelativeTime(run.started_at)}
                      </Text>
                    </View>
                    <Badge label={meta.label} tone={meta.tone} dot />
                  </View>
                </PressableScale>
              )
            })}
          </Panel>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionLabel title="Telemetria do nó" />
        <Panel>
          <View style={styles.telemetryGrid}>
            <TelemetryRow
              label="Hermes"
              value={hermesOnline ? 'Conectado' : 'Desconectado'}
              ok={Boolean(hermesOnline)}
            />
            <TelemetryRow
              label="Banco"
              value={dbOnline ? 'Online' : 'Falha'}
              ok={Boolean(dbOnline)}
            />
            <TelemetryRow
              label="Saúde"
              value={systemStatus?.overall ?? '—'}
              ok={overallOk}
            />
            <TelemetryRow
              label="Versão"
              value={systemStatus?.version ?? '—'}
              ok
            />
          </View>
          <View style={styles.telemetryFooter}>
            <Ionicons name="time-outline" size={12} color={colors.faint} />
            <Text style={styles.telemetryFooterText}>
              Sincronizado {lastUpdated ? formatRelativeTime(lastUpdated) : '—'}
            </Text>
          </View>
        </Panel>
      </View>

      <View style={styles.section}>
        <SectionLabel title="Diretrizes sugeridas" />
        <View style={styles.suggestionList}>
          {SUGGESTIONS.map((suggestion) => (
            <PressableScale
              key={suggestion}
              accessibilityLabel={`Usar sugestão: ${suggestion}`}
              haptic="selection"
              onPress={() => setPrompt(suggestion)}
              style={styles.suggestionPress}
            >
              <View style={styles.suggestionRow}>
                <Ionicons name="sparkles-outline" size={15} color={colors.cyan} />
                <Text style={styles.suggestionText} numberOfLines={2}>
                  {suggestion}
                </Text>
                <Ionicons name="arrow-forward" size={14} color={colors.faint} />
              </View>
            </PressableScale>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Ionicons name="lock-closed-outline" size={12} color={colors.faint} />
        <Text style={styles.footerText}>INTERFACE NEURAL ODIN · V2 · MOBILE ARM</Text>
      </View>
    </HudScreen>
  )
}

function TelemetryRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <View style={styles.telemetryRow}>
      <Text style={styles.telemetryLabel}>{label}</Text>
      <View style={styles.telemetryValueWrap}>
        <View
          style={[
            styles.telemetryDot,
            { backgroundColor: ok ? colors.successLight : colors.dangerLight },
          ]}
        />
        <Text
          style={[
            styles.telemetryValue,
            { color: ok ? colors.textSoft : colors.dangerLight },
          ]}
          numberOfLines={1}
        >
          {value}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  heroWrap: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    marginTop: -spacing.xs,
  },
  heroCopy: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  heroEyebrow: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    letterSpacing: 2.6,
    color: colors.primaryLight,
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    letterSpacing: -0.6,
    color: colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  statusText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    color: colors.muted,
  },
  sectionHint: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.faint,
    textTransform: 'uppercase',
  },
  commandShell: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.34),
    backgroundColor: alpha(colors.surface, 0.92),
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  commandInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    paddingVertical: 9,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  sendButtonDisabled: {
    opacity: 0.38,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.xs,
    paddingHorizontal: 4,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.dangerLight,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  linkText: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.primaryLight,
    textTransform: 'uppercase',
  },
  conversationPress: {
    alignSelf: 'stretch',
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  conversationRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  conversationIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.24),
    backgroundColor: alpha(colors.primary, 0.08),
  },
  conversationCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  conversationTitle: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.text,
  },
  conversationMeta: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.dim,
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  runCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  runTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSoft,
  },
  telemetryGrid: {
    gap: 2,
  },
  telemetryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: alpha(colors.border, 0.7),
  },
  telemetryLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  telemetryValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '62%',
  },
  telemetryDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  telemetryValue: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: colors.textSoft,
  },
  telemetryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  telemetryFooterText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.4,
    color: colors.faint,
  },
  suggestionList: {
    gap: spacing.xs,
  },
  suggestionPress: {
    alignSelf: 'stretch',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.surface, 0.7),
  },
  suggestionText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSoft,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingBottom: spacing.xs,
  },
  footerText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1.1,
    color: colors.faint,
  },
  alertPanel: {
    borderColor: alpha(colors.warning, 0.35),
    backgroundColor: alpha(colors.warning, 0.06),
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.warning, 0.32),
    backgroundColor: alpha(colors.warning, 0.1),
  },
  alertCopy: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    letterSpacing: 1,
    color: colors.warningLight,
    textTransform: 'uppercase',
  },
  alertText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSoft,
  },
  approvalList: {
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  approvalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: alpha(colors.warning, 0.2),
  },
  approvalInfo: {
    flex: 1,
    minWidth: 0,
  },
  approvalOperation: {
    fontFamily: fonts.monoMedium,
    fontSize: 10,
    color: colors.text,
  },
  approvalMeta: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
    marginTop: 2,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: 6,
  },
  approvalAction: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.34),
    backgroundColor: alpha(colors.danger, 0.1),
  },
  approvalActionPrimary: {
    borderColor: alpha(colors.primary, 0.4),
    backgroundColor: colors.primary,
  },
})
