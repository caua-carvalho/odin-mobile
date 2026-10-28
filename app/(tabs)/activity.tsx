import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { HudScreen } from '../../components/hud/Screen'
import { ScreenHeader } from '../../components/hud/ScreenHeader'
import {
  Badge,
  EmptyState,
  Panel,
  PressableScale,
  SectionLabel,
  type BadgeTone,
} from '../../components/hud/primitives'
import { useOdinStatus } from '../../contexts/OdinStatusContext'
import { api, type Approval, type Run } from '../../lib/api'
import { alpha, colors, fonts, radius, spacing } from '../../lib/theme'
import {
  formatDate,
  formatDuration,
  formatRelativeTime,
  getErrorMessage,
  pluralize,
  pretty,
} from '../../lib/utils'

type TabKey = 'runs' | 'approvals'

const RUN_META: Record<
  string,
  { label: string; tone: BadgeTone; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }
> = {
  queued: { label: 'Na fila', tone: 'neutral', icon: 'time-outline', color: colors.dim },
  running: { label: 'Executando', tone: 'primary', icon: 'sync-outline', color: colors.primaryLight },
  waiting_approval: {
    label: 'Aguardando',
    tone: 'warning',
    icon: 'shield-half-outline',
    color: colors.warningLight,
  },
  completed: { label: 'Concluída', tone: 'success', icon: 'checkmark-circle-outline', color: colors.successLight },
  failed: { label: 'Falhou', tone: 'danger', icon: 'close-circle-outline', color: colors.dangerLight },
  cancelled: { label: 'Cancelada', tone: 'neutral', icon: 'ban-outline', color: colors.dim },
  interrupted: { label: 'Interrompida', tone: 'neutral', icon: 'flash-outline', color: colors.dim },
}

const APPROVAL_META: Record<
  string,
  { label: string; tone: BadgeTone; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }
> = {
  pending: { label: 'Pendente', tone: 'warning', icon: 'time-outline', color: colors.warningLight },
  approved: { label: 'Aprovada', tone: 'success', icon: 'checkmark-circle-outline', color: colors.successLight },
  denied: { label: 'Negada', tone: 'danger', icon: 'close-circle-outline', color: colors.dangerLight },
  expired: { label: 'Expirada', tone: 'neutral', icon: 'hourglass-outline', color: colors.dim },
}

export default function ActivityScreen() {
  const router = useRouter()
  const { refresh: refreshStatus } = useOdinStatus()

  const [runs, setRuns] = useState<Run[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabKey>('runs')
  const [expandedRun, setExpandedRun] = useState<string | null>(null)
  const [busyApproval, setBusyApproval] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [runsData, approvalsData] = await Promise.all([
        api.listRuns({ page_size: 50 }),
        api.listApprovals(),
      ])
      if (!mounted.current) return
      setRuns(runsData)
      setApprovals(approvalsData.items)
      setError(null)
    } catch (err) {
      if (mounted.current) setError(getErrorMessage(err, 'Erro ao carregar a atividade.'))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial fetch plus polling; data lands after the awaited requests resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
    const timer = setInterval(() => {
      void loadData()
    }, 20_000)
    return () => clearInterval(timer)
  }, [loadData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.allSettled([loadData(), refreshStatus()])
    if (mounted.current) setRefreshing(false)
  }

  const resolveApproval = async (approval: Approval, decision: 'approve' | 'deny') => {
    if (busyApproval) return
    setBusyApproval(approval.id)
    try {
      if (decision === 'approve') await api.approve(approval.id)
      else await api.deny(approval.id)
      setApprovals((previous) =>
        previous.map((item) =>
          item.id === approval.id
            ? {
                ...item,
                status: decision === 'approve' ? 'approved' : 'denied',
                resolved_at: new Date().toISOString(),
              }
            : item,
        ),
      )
      void refreshStatus()
    } catch (err) {
      Alert.alert('Falha', getErrorMessage(err, 'Não foi possível responder à autorização.'))
    } finally {
      if (mounted.current) setBusyApproval(null)
    }
  }

  const pending = approvals.filter((approval) => approval.status === 'pending')
  const resolved = approvals.filter((approval) => approval.status !== 'pending')
  const activeRuns = runs.filter((run) => ['queued', 'running', 'waiting_approval'].includes(run.status))

  return (
    <HudScreen scroll={false}>
      <ScreenHeader
        eyebrow="Fluxo operacional"
        title="Atividade"
        subtitle="Execuções do agente e protocolos que aguardam a sua validação."
        right={
          activeRuns.length > 0 ? (
            <Badge
              label={`${activeRuns.length} ativo${activeRuns.length > 1 ? 's' : ''}`}
              tone="primary"
              dot
            />
          ) : (
            <Badge label="Em repouso" tone="neutral" dot />
          )
        }
      />

      <View style={styles.tabWrap}>
        <TabButton
          label="Execuções"
          icon="terminal-outline"
          active={activeTab === 'runs'}
          count={runs.length}
          onPress={() => setActiveTab('runs')}
        />
        <TabButton
          label="Aprovações"
          icon="shield-half-outline"
          active={activeTab === 'approvals'}
          count={pending.length}
          highlight={pending.length > 0}
          onPress={() => setActiveTab('approvals')}
        />
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="warning-outline" size={13} color={colors.dangerLight} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && runs.length === 0 && approvals.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Sincronizando atividade…</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
          {activeTab === 'runs' ? (
            runs.length === 0 ? (
              <EmptyState
                icon="terminal-outline"
                title="Nenhuma execução"
                description="Inicie uma conversa para ver o histórico de runs do Hermes aqui."
              />
            ) : (
              <>
                {activeRuns.length > 0 ? (
                  <View style={styles.section}>
                    <SectionLabel title="Em andamento" />
                    {activeRuns.map((run, index) => (
                      <Animated.View
                        key={run.id}
                        entering={FadeInDown.delay(index * 35).duration(260)}
                      >
                        <RunCard
                          run={run}
                          expanded={expandedRun === run.id}
                          onToggle={() => setExpandedRun((previous) => (previous === run.id ? null : run.id))}
                          onOpenSession={() =>
                            router.push({
                              pathname: '/(tabs)/chat',
                              params: { conversationId: run.conversation_id },
                            })
                          }
                        />
                      </Animated.View>
                    ))}
                  </View>
                ) : null}

                <View style={styles.section}>
                  <SectionLabel title="Histórico de execuções" />
                  {runs.map((run, index) => (
                    <Animated.View
                      key={run.id}
                      entering={FadeInDown.delay(Math.min(index, 8) * 30).duration(240)}
                    >
                      <RunCard
                        run={run}
                        expanded={expandedRun === run.id}
                        onToggle={() => setExpandedRun((previous) => (previous === run.id ? null : run.id))}
                        onOpenSession={() =>
                          router.push({
                            pathname: '/(tabs)/chat',
                            params: { conversationId: run.conversation_id },
                          })
                        }
                      />
                    </Animated.View>
                  ))}
                </View>
              </>
            )
          ) : approvals.length === 0 ? (
            <EmptyState
              icon="shield-checkmark-outline"
              title="Nenhuma aprovação"
              description="Operações que exigem a sua validação aparecerão aqui em tempo real."
            />
          ) : (
            <>
              {pending.length > 0 ? (
                <View style={styles.section}>
                  <SectionLabel title="Aguardando o operador" />
                  {pending.map((approval, index) => (
                    <Animated.View
                      key={approval.id}
                      entering={FadeInDown.delay(index * 40).duration(260)}
                    >
                      <ApprovalCard
                        approval={approval}
                        busy={busyApproval === approval.id}
                        onApprove={() => void resolveApproval(approval, 'approve')}
                        onDeny={() => void resolveApproval(approval, 'deny')}
                      />
                    </Animated.View>
                  ))}
                </View>
              ) : null}

              {resolved.length > 0 ? (
                <View style={styles.section}>
                  <SectionLabel
                    title="Resolvidas"
                    right={
                      <Text style={styles.sectionMeta}>
                        {resolved.length} {pluralize(resolved.length, 'registro', 'registros')}
                      </Text>
                    }
                  />
                  {resolved.slice(0, 20).map((approval) => (
                    <ApprovalCard key={approval.id} approval={approval} readonly />
                  ))}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </HudScreen>
  )
}

function TabButton({
  label,
  icon,
  active,
  count,
  highlight = false,
  onPress,
}: {
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  active: boolean
  count: number
  highlight?: boolean
  onPress: () => void
}) {
  return (
    <PressableScale
      accessibilityLabel={label}
      accessibilityRole="tab"
      haptic="selection"
      onPress={onPress}
      style={styles.tabPress}
    >
      <View style={[styles.tab, active && styles.tabActive]}>
        <Ionicons name={icon} size={15} color={active ? colors.bg : colors.muted} />
        <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
        {count > 0 ? (
          <View
            style={[
              styles.tabCount,
              active && styles.tabCountActive,
              highlight && !active && styles.tabCountHighlight,
            ]}
          >
            <Text
              style={[
                styles.tabCountText,
                active && styles.tabCountTextActive,
                highlight && !active && styles.tabCountTextHighlight,
              ]}
            >
              {count > 99 ? '99+' : count}
            </Text>
          </View>
        ) : null}
      </View>
    </PressableScale>
  )
}

function RunCard({
  run,
  expanded,
  onToggle,
  onOpenSession,
}: {
  run: Run
  expanded: boolean
  onToggle: () => void
  onOpenSession: () => void
}) {
  const meta = RUN_META[run.status] ?? RUN_META.queued
  return (
    <Panel style={styles.runCard}>
      <PressableScale accessibilityLabel={`Detalhes da execução ${run.id.slice(0, 8)}`} haptic="selection" onPress={onToggle}>
        <View style={styles.runHeader}>
          <View style={[styles.runIcon, { borderColor: alpha(meta.color, 0.32) }]}>
            <Ionicons name={meta.icon} size={16} color={meta.color} />
          </View>
          <View style={styles.runCopy}>
            <Text style={styles.runId}>Run {run.id.slice(0, 8)}</Text>
            <Text style={styles.runTime}>
              {formatRelativeTime(run.started_at)} · {run.conversation_id.slice(0, 8)}
            </Text>
          </View>
          <Badge label={meta.label} tone={meta.tone} dot />
        </View>
      </PressableScale>

      <View style={styles.runMetaRow}>
        <View style={styles.runMetaItem}>
          <Ionicons name="calendar-outline" size={11} color={colors.faint} />
          <Text style={styles.runMetaText}>{formatDate(run.started_at)}</Text>
        </View>
        <View style={styles.runMetaItem}>
          <Ionicons name="timer-outline" size={11} color={colors.faint} />
          <Text style={styles.runMetaText}>
            {formatDuration(run.started_at, run.completed_at)}
          </Text>
        </View>
        {run.queue_position ? (
          <Badge label={`${run.queue_position}º na fila`} tone="neutral" />
        ) : null}
      </View>

      {run.result_summary && !expanded ? (
        <Text style={styles.runPreview} numberOfLines={2}>
          {run.result_summary}
        </Text>
      ) : null}

      {expanded ? (
        <View style={styles.runExpanded}>
          {run.result_summary ? (
            <View style={styles.resultBox}>
              <Text style={styles.resultLabel}>Resultado</Text>
              <Text style={styles.resultText}>{run.result_summary}</Text>
            </View>
          ) : null}

          {run.error ? (
            <View style={styles.runErrorBox}>
              <Ionicons name="warning-outline" size={13} color={colors.dangerLight} />
              <Text style={styles.runErrorText}>{run.error}</Text>
            </View>
          ) : null}

          {run.events && run.events.length > 0 ? (
            <View style={styles.eventsBox}>
              <Text style={styles.resultLabel}>Eventos ({run.events.length})</Text>
              {run.events.slice(-8).map((event, index) => (
                <View key={`${event.type}-${index}`} style={styles.eventRow}>
                  <View style={styles.eventDot} />
                  <Text style={styles.eventTime}>{formatDate(event.timestamp)}</Text>
                  <Text style={styles.eventType}>{event.type}</Text>
                  <Text style={styles.eventData} numberOfLines={1}>
                    {pretty(event.data, 90)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <PressableScale
            accessibilityLabel="Abrir sessão da execução"
            haptic="selection"
            onPress={onOpenSession}
          >
            <View style={styles.openSession}>
              <Ionicons name="chatbubbles-outline" size={14} color={colors.primaryLight} />
              <Text style={styles.openSessionText}>Abrir sessão</Text>
              <Ionicons name="arrow-forward" size={13} color={colors.primaryLight} />
            </View>
          </PressableScale>
        </View>
      ) : null}
    </Panel>
  )
}

function ApprovalCard({
  approval,
  busy = false,
  readonly = false,
  onApprove,
  onDeny,
}: {
  approval: Approval
  busy?: boolean
  readonly?: boolean
  onApprove?: () => void
  onDeny?: () => void
}) {
  const meta = APPROVAL_META[approval.status] ?? APPROVAL_META.pending
  const details = (approval.details || {}) as Record<string, any>
  const command = typeof details.command === 'string' ? details.command : ''
  const description = typeof details.description === 'string' ? details.description : ''

  return (
    <Panel
      glow={approval.status === 'pending' ? 'orange' : 'none'}
      style={[styles.approvalCard, approval.status === 'pending' && styles.approvalCardPending]}
    >
      <View style={styles.approvalHeader}>
        <View style={[styles.approvalIcon, { borderColor: alpha(meta.color, 0.32) }]}>
          <Ionicons name={meta.icon} size={17} color={meta.color} />
        </View>
        <View style={styles.approvalCopy}>
          <Text style={styles.approvalOperation} numberOfLines={1}>
            {approval.operation}
          </Text>
          <Text style={styles.approvalMeta}>
            Run {approval.run_id.slice(0, 8)} · {formatRelativeTime(approval.created_at)}
          </Text>
        </View>
        <Badge label={meta.label} tone={meta.tone} dot />
      </View>

      {description ? <Text style={styles.approvalDescription}>{description}</Text> : null}

      {command ? (
        <View style={styles.commandBox}>
          <Text style={styles.commandText} numberOfLines={6}>
            {command}
          </Text>
        </View>
      ) : null}

      {!command && Object.keys(details).length > 0 ? (
        <Text style={styles.approvalDetails} numberOfLines={3}>
          {pretty(details, 180)}
        </Text>
      ) : null}

      {approval.expires_at ? (
        <View style={styles.expiryRow}>
          <Ionicons name="hourglass-outline" size={11} color={colors.dim} />
          <Text style={styles.expiryText}>Expira {formatRelativeTime(approval.expires_at)}</Text>
        </View>
      ) : null}

      {!readonly && approval.status === 'pending' ? (
        <View style={styles.approvalActions}>
          <PressableScale
            accessibilityLabel="Negar autorização"
            haptic="light"
            disabled={busy}
            onPress={onDeny}
            style={styles.approvalActionPress}
          >
            <View style={[styles.approvalAction, styles.approvalActionDeny]}>
              <Ionicons name="close" size={14} color={colors.dangerLight} />
              <Text style={[styles.approvalActionText, { color: colors.dangerLight }]}>Negar</Text>
            </View>
          </PressableScale>
          <PressableScale
            accessibilityLabel="Aprovar autorização"
            haptic="medium"
            disabled={busy}
            onPress={onApprove}
            style={styles.approvalActionPress}
          >
            <View style={[styles.approvalAction, styles.approvalActionAllow, busy && { opacity: 0.55 }]}>
              {busy ? (
                <ActivityIndicator size="small" color={colors.bg} />
              ) : (
                <Ionicons name="checkmark" size={14} color={colors.bg} />
              )}
              <Text style={[styles.approvalActionText, { color: colors.bg }]}>Aprovar</Text>
            </View>
          </PressableScale>
        </View>
      ) : null}
    </Panel>
  )
}

const styles = StyleSheet.create({
  tabWrap: {    flexDirection: 'row',
    gap: 4,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.surface, 0.85),
  },
  tabPress: {
    flex: 1,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  tabTextActive: {
    color: colors.bg,
  },
  tabCount: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: alpha(colors.elevated, 0.9),
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabCountActive: {
    backgroundColor: alpha(colors.bg, 0.2),
    borderColor: alpha(colors.bg, 0.3),
  },
  tabCountHighlight: {
    borderColor: alpha(colors.warning, 0.4),
    backgroundColor: alpha(colors.warning, 0.16),
  },
  tabCountText: {
    fontFamily: fonts.monoBold,
    fontSize: 7,
    color: colors.dim,
  },
  tabCountTextActive: {
    color: colors.bg,
  },
  tabCountTextHighlight: {
    color: colors.warningLight,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xs,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.dangerLight,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 0.8,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexGrow: 1,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionMeta: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.5,
    color: colors.faint,
  },
  runCard: {
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  runHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  runIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: alpha(colors.bg, 0.45),
  },
  runCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  runId: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.text,
  },
  runTime: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
  },
  runMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  runMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  runMetaText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
  },
  runPreview: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
  runExpanded: {
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: spacing.xs,
  },
  resultBox: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.bg, 0.5),
    padding: spacing.sm,
    gap: 4,
  },
  resultLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  resultText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 14,
    color: colors.textSoft,
  },
  runErrorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.3),
    backgroundColor: alpha(colors.danger, 0.07),
    padding: spacing.sm,
  },
  runErrorText: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 14,
    color: colors.dangerLight,
  },
  eventsBox: {
    gap: 5,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  eventTime: {
    fontFamily: fonts.mono,
    fontSize: 7,
    color: colors.faint,
  },
  eventType: {
    fontFamily: fonts.monoMedium,
    fontSize: 8,
    color: colors.primaryLight,
  },
  eventData: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 7,
    color: colors.dim,
  },
  openSession: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.28),
    backgroundColor: alpha(colors.primary, 0.08),
  },
  openSessionText: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    letterSpacing: 0.5,
    color: colors.primaryLight,
    textTransform: 'uppercase',
  },
  approvalCard: {
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  approvalCardPending: {
    borderColor: alpha(colors.warning, 0.32),
    backgroundColor: alpha(colors.warning, 0.05),
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
    backgroundColor: alpha(colors.bg, 0.45),
  },
  approvalCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  approvalOperation: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.text,
  },
  approvalMeta: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
  },
  approvalDescription: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.muted,
  },
  commandBox: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.bg, 0.6),
    padding: spacing.sm,
  },
  commandText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 14,
    color: colors.textSoft,
  },
  approvalDetails: {
    fontFamily: fonts.mono,
    fontSize: 8,
    lineHeight: 13,
    color: colors.dim,
  },
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expiryText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
  },
  approvalActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  approvalActionPress: {
    flex: 1,
  },
  approvalAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  approvalActionDeny: {
    borderColor: alpha(colors.danger, 0.34),
    backgroundColor: alpha(colors.danger, 0.1),
  },
  approvalActionAllow: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  approvalActionText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
  },
})
