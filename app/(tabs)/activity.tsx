import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, FlatList, Alert, ActivityIndicator, Modal } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { cn, formatRelativeTime, formatDate } from '../../lib/utils'
import { api, type Run, type Approval, type RunEvent } from '../../lib/api'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#181818' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#ff6b00' },
  tabsContainer: { flexDirection: 'row', backgroundColor: '#101010', padding: 4, marginHorizontal: 16, marginTop: 12, borderRadius: 10 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8 },
  tabActive: { backgroundColor: '#ff6b00' },
  tabText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#0a0a0a' },
  badge: { backgroundColor: '#e05600', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 18, alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  listContainer: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  runCard: { backgroundColor: '#101010', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#282828' },
  runHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  runStatusDot: { width: 10, height: 10, borderRadius: 5 },
  runInfo: { flex: 1 },
  runConvId: { color: '#fff', fontSize: 14, fontWeight: '600' },
  runStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  runStatusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  runMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  runMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, color: '#686868', fontSize: 12 },
  runExpanded: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#282828' },
  runResult: { backgroundColor: '#181818', borderRadius: 8, padding: 12, marginBottom: 8 },
  runResultText: { color: '#a8a8a8', fontSize: 13, fontFamily: 'monospace' },
  runError: { backgroundColor: '#e0560020', borderWidth: 1, borderColor: '#e0560040', borderRadius: 8, padding: 12, marginBottom: 8 },
  runErrorText: { color: '#e05600', fontSize: 13, fontFamily: 'monospace' },
  eventsList: { gap: 8 },
  eventRow: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  eventIcon: { marginTop: 2 },
  eventTime: { color: '#505050', fontSize: 11, fontFamily: 'monospace' },
  eventType: { color: '#ff6b00', fontSize: 11, fontWeight: '600', fontFamily: 'monospace' },
  eventData: { color: '#686868', fontSize: 10, fontFamily: 'monospace', flex: 1 },
  approvalCard: { backgroundColor: '#101010', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#282828' },
  approvalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  approvalIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  approvalInfo: { flex: 1 },
  approvalOperation: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: 'monospace' },
  approvalStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 4 },
  approvalStatusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  approvalDetails: { color: '#686868', fontSize: 12, fontFamily: 'monospace', marginTop: 8 },
  approvalDate: { color: '#505050', fontSize: 11, marginTop: 8 },
  approvalActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  approvalBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: '#181818', borderWidth: 1, borderColor: '#282828' },
  approvalBtnPrimary: { backgroundColor: '#ff6b00', borderColor: '#ff6b00' },
  approvalBtnDanger: { backgroundColor: '#e05600', borderColor: '#e05600' },
  approvalBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { color: '#686868', fontSize: 14, textAlign: 'center' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,10,10,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  sectionTitle: { color: '#686868', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, paddingHorizontal: 16, marginTop: 8 },
})

const RUN_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  queued: { label: 'Na fila', color: '#686868', bg: '#181818', icon: 'time' },
  running: { label: 'Executando', color: '#ff6b00', bg: '#ff6b0020', icon: 'refresh' },
  waiting_approval: { label: 'Aguardando aprovação', color: '#ffaa00', bg: '#ffaa0020', icon: 'alert-circle' },
  completed: { label: 'Concluído', color: '#00d47e', bg: '#00d47e20', icon: 'checkmark-circle' },
  failed: { label: 'Falhou', color: '#e05600', bg: '#e0560020', icon: 'close-circle' },
  cancelled: { label: 'Cancelado', color: '#686868', bg: '#181818', icon: 'close-circle' },
  interrupted: { label: 'Interrompido', color: '#686868', bg: '#181818', icon: 'flash' },
}

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = {
  pending: { label: 'Pendente', color: '#ffaa00', bg: '#ffaa0020', icon: 'time' },
  approved: { label: 'Aprovado', color: '#00d47e', bg: '#00d47e20', icon: 'checkmark-circle' },
  denied: { label: 'Negado', color: '#e05600', bg: '#e0560020', icon: 'close-circle' },
  expired: { label: 'Expirado', color: '#686868', bg: '#181818', icon: 'time' },
}

export default function ActivityScreen() {
  const [runs, setRuns] = useState<Run[]>([])
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'runs' | 'approvals'>('runs')
  const [expandedRun, setExpandedRun] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      const [runsData, approvalsData] = await Promise.all([
        api.listRuns({ page_size: 50 }).catch(() => []),
        api.listApprovals().catch(() => ({ items: [] })),
      ])
      setRuns(runsData || [])
      setApprovals(approvalsData.items || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (approvalId: string) => {
    try {
      await api.approve(approvalId)
      setApprovals(prev => prev.map(a => a.id === approvalId ? { ...a, status: 'approved' as const } : a))
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Erro ao aprovar')
    }
  }

  const handleDeny = async (approvalId: string) => {
    try {
      await api.deny(approvalId)
      setApprovals(prev => prev.map(a => a.id === approvalId ? { ...a, status: 'denied' as const } : a))
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Erro ao negar')
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ff6b00" />
        </View>
      </SafeAreaView>
    )
  }

  const pendingCount = approvals.filter(a => a.status === 'pending').length

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Atividade</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity onPress={() => setActiveTab('runs')} style={[styles.tab, activeTab === 'runs' && styles.tabActive]}>
          <Ionicons name="terminal" size={20} color={activeTab === 'runs' ? '#0a0a0a' : '#fff'} />
          <Text style={[styles.tabText, activeTab === 'runs' && styles.tabTextActive]}>Execuções</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('approvals')} style={[styles.tab, activeTab === 'approvals' && styles.tabActive]}>
          <Ionicons name="shield" size={20} color={activeTab === 'approvals' ? '#0a0a0a' : '#fff'} />
          <Text style={[styles.tabText, activeTab === 'approvals' && styles.tabTextActive]}>Aprovações</Text>
          {pendingCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{pendingCount}</Text></View>}
        </TouchableOpacity>
      </View>

      {activeTab === 'runs' && (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {runs.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="terminal-outline" size={64} color="#282828" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>Nenhuma execução</Text>
              <Text style={styles.emptySubtitle}>Inicie uma conversa no Chat para ver execuções aqui</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Execuções Recentes</Text>
              <FlatList
                data={runs}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <RunCard
                    run={item}
                    isExpanded={expandedRun === item.id}
                    onPress={() => setExpandedRun(prev => prev === item.id ? null : item.id)}
                  />
                )}
              />
            </>
          )}
        </ScrollView>
      )}

      {activeTab === 'approvals' && (
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {approvals.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-outline" size={64} color="#282828" style={styles.emptyIcon} />
              <Text style={styles.emptyTitle}>Nenhuma aprovação</Text>
              <Text style={styles.emptySubtitle}>Operações que exigem sua aprovação aparecerão aqui</Text>
            </View>
          ) : (
            <>
              {approvals.filter(a => a.status === 'pending').length > 0 && (
                <Text style={styles.sectionTitle}>Pendentes</Text>
              )}
              <FlatList
                data={approvals.filter(a => a.status === 'pending')}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <ApprovalCard approval={item} onApprove={handleApprove} onDeny={handleDeny} />}
              />
              {approvals.filter(a => a.status !== 'pending').length > 0 && (
                <Text style={styles.sectionTitle}>Resolvidas</Text>
              )}
              <FlatList
                data={approvals.filter(a => a.status !== 'pending').slice(0, 10)}
                keyExtractor={item => item.id}
                renderItem={({ item }) => <ApprovalCard approval={item} onApprove={handleApprove} onDeny={handleDeny} readonly />}
              />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

function RunCard({ run, isExpanded, onPress }: { run: Run; isExpanded: boolean; onPress: () => void }) {
  const config = RUN_STATUS_CONFIG[run.status] || RUN_STATUS_CONFIG.queued

  return (
    <TouchableOpacity onPress={onPress} style={styles.runCard} activeOpacity={0.9}>
      <View style={styles.runHeader}>
        <View style={[styles.runStatusDot, { backgroundColor: config.color }]} />
        <View style={styles.runInfo}>
          <Text style={styles.runConvId}>Run {run.id.slice(0, 8)}...</Text>
          <View style={[styles.runStatusBadge, { backgroundColor: config.bg, borderWidth: 1, borderColor: config.color + '60' }]}>
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text style={[styles.runStatusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>
      </View>

      <View style={styles.runMeta}>
        <View style={styles.runMetaItem}>
          <Ionicons name="calendar" size={14} />
          <Text>{formatDate(run.started_at)}</Text>
        </View>
        {run.completed_at && (
          <View style={styles.runMetaItem}>
            <Ionicons name="timer" size={14} />
            <Text>{Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)}s</Text>
          </View>
        )}
      </View>

      {isExpanded && (
        <View style={styles.runExpanded}>
          {run.result_summary && (
            <View style={styles.runResult}>
              <Text style={styles.runResultText}>{run.result_summary}</Text>
            </View>
          )}
          {run.error && (
            <View style={styles.runError}>
              <Text style={styles.runErrorText}>{run.error}</Text>
            </View>
          )}
          {run.events && run.events.length > 0 && (
            <View style={styles.eventsList}>
              {run.events.map((event, idx) => (
                <View key={idx} style={styles.eventRow}>
                  <Ionicons name="ellipse" size={12} color="#ff6b00" style={styles.eventIcon} />
                  <Text style={styles.eventTime}>{formatDate(event.timestamp)}</Text>
                  <Text style={styles.eventType}>{event.type}</Text>
                  <Text style={styles.eventData} numberOfLines={1}>{JSON.stringify(event.data).slice(0, 80)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

function ApprovalCard({ approval, onApprove, onDeny, readonly = false }: { approval: Approval; onApprove: (id: string) => void; onDeny: (id: string) => void; readonly?: boolean }) {
  const config = APPROVAL_STATUS_CONFIG[approval.status] || APPROVAL_STATUS_CONFIG.pending

  return (
    <View style={styles.approvalCard}>
      <View style={styles.approvalHeader}>
        <View style={[styles.approvalIcon, { backgroundColor: config.bg, borderWidth: 1, borderColor: config.color + '60' }]}>
          <Ionicons name={config.icon} size={20} color={config.color} />
        </View>
        <View style={styles.approvalInfo}>
          <Text style={styles.approvalOperation}>{approval.operation}</Text>
          <View style={[styles.approvalStatusBadge, { backgroundColor: config.bg, borderWidth: 1, borderColor: config.color + '60' }]}>
            <Ionicons name={config.icon} size={12} color={config.color} />
            <Text style={[styles.approvalStatusText, { color: config.color }]}>{config.label}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.approvalDetails}>{JSON.stringify(approval.details).slice(0, 120)}</Text>

      <Text style={styles.approvalDate}>
        Criado em {formatDate(approval.created_at)}
        {approval.expires_at && ` • Expira em ${formatDate(approval.expires_at)}`}
      </Text>

      {!readonly && approval.status === 'pending' && (
        <View style={styles.approvalActions}>
          <TouchableOpacity onPress={() => onDeny(approval.id)} style={styles.approvalBtn}>
            <Ionicons name="close" size={18} />
            <Text style={styles.approvalBtnText}>Negar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onApprove(approval.id)} style={[styles.approvalBtn, styles.approvalBtnPrimary]}>
            <Ionicons name="checkmark" size={18} />
            <Text style={styles.approvalBtnText}>Aprovar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}