import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { cn, formatRelativeTime } from '../../lib/utils'
import { api, type SystemStatus } from '../../lib/api'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#181818' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#ff6b00' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#181818', borderRadius: 8, borderWidth: 1, borderColor: '#282828' },
  refreshBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  overallCard: { margin: 16, padding: 20, borderRadius: 16, backgroundColor: '#101010', borderWidth: 1, borderColor: '#282828' },
  overallHeader: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  overallIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  overallInfo: { flex: 1 },
  overallTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  overallStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  overallStatusText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  overallTimestamp: { color: '#686868', fontSize: 12, marginTop: 4 },
  sectionTitle: { color: '#686868', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginHorizontal: 16, marginTop: 8, marginBottom: 12 },
  componentCard: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, backgroundColor: '#101010', borderWidth: 1, borderColor: '#282828' },
  componentHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  componentIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  componentInfo: { flex: 1 },
  componentName: { color: '#fff', fontSize: 15, fontWeight: '600', textTransform: 'capitalize' },
  componentStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  componentStatusText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  componentDetails: { marginTop: 12, gap: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  detailLabel: { color: '#686868', fontSize: 12 },
  detailValue: { color: '#a8a8a8', fontSize: 12, fontFamily: 'monospace' },
  infoCard: { marginHorizontal: 16, marginBottom: 12, padding: 16, borderRadius: 12, backgroundColor: '#101010', borderWidth: 1, borderColor: '#282828' },
  infoTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  infoItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#181818' },
  infoLabel: { color: '#686868', fontSize: 13 },
  infoValue: { color: '#fff', fontSize: 13, fontFamily: 'monospace' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,10,10,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
})

const COMPONENT_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  gateway: 'server',
  dashboard: 'desktop',
  storage: 'server',
  platforms: 'wifi',
  memory: 'hardware-chip',
  disk: 'save',
  cpu: 'cube',
}

export default function SystemScreen() {
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStatus = async () => {
    try {
      const data = await api.getSystemStatus()
      setStatus(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadStatus()
    const interval = setInterval(loadStatus, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading && !status) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ff6b00" />
        </View>
      </SafeAreaView>
    )
  }

  const isOk = status?.overall === 'ok'

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sistema</Text>
        <TouchableOpacity onPress={() => { setRefreshing(true); loadStatus(); }} style={styles.refreshBtn} disabled={refreshing}>
          <Ionicons name={refreshing ? 'refresh' : 'refresh-outline'} size={20} color="#fff" style={{ transform: [{ rotate: refreshing ? '360deg' : '0deg' }] }} />
          <Text style={styles.refreshBtnText}>Atualizar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={loadStatus} colors={['#ff6b00']} />
      }>
        {/* Overall Status */}
        <View style={styles.overallCard}>
          <View style={styles.overallHeader}>
            <View style={[styles.overallIcon, { backgroundColor: isOk ? '#00d47e20' : '#ffaa0020' }]}>
              <Ionicons name={isOk ? 'checkmark-circle' : 'alert-circle'} size={28} color={isOk ? '#00d47e' : '#ffaa00'} />
            </View>
            <View style={styles.overallInfo}>
              <Text style={styles.overallTitle}>Status Geral</Text>
              <View style={styles.overallStatus}>
                <View style={[styles.statusDot, { backgroundColor: isOk ? '#00d47e' : '#ffaa00' }]} />
                <Text style={[styles.overallStatusText, { color: isOk ? '#00d47e' : '#ffaa00' }]}>
                  {isOk ? 'Saudável' : 'Degradado'}
                </Text>
              </View>
              <Text style={styles.overallTimestamp}>
                Última verificação: {status?.timestamp ? formatRelativeTime(status.timestamp) : 'Desconhecido'}
                {refreshing && ' (atualizando...)'}
              </Text>
            </View>
          </View>
        </View>

        {/* Components */}
        <Text style={styles.sectionTitle}>Componentes</Text>
        {status?.components && Object.entries(status.components).map(([key, component]) => (
          <View key={key} style={styles.componentCard}>
            <View style={styles.componentHeader}>
              <View style={[styles.componentIcon, { backgroundColor: component.status === 'ok' ? '#00d47e20' : '#e0560020' }]}>
                <Ionicons name={COMPONENT_ICONS[key] || 'information-circle'} size={20} color={component.status === 'ok' ? '#00d47e' : '#e05600'} />
              </View>
              <View style={styles.componentInfo}>
                <Text style={styles.componentName}>{key}</Text>
                <View style={[styles.componentStatusBadge, { backgroundColor: component.status === 'ok' ? '#00d47e20' : '#e0560020', borderWidth: 1, borderColor: (component.status === 'ok' ? '#00d47e' : '#e05600') + '60' }]}>
                  <Ionicons name={component.status === 'ok' ? 'checkmark' : 'close'} size={12} color={component.status === 'ok' ? '#00d47e' : '#e05600'} />
                  <Text style={[styles.componentStatusText, { color: component.status === 'ok' ? '#00d47e' : '#e05600' }]}>{component.status}</Text>
                </View>
              </View>
            </View>
            {component.details && (
              <View style={styles.componentDetails}>
                {Object.entries(component.details).slice(0, 6).map(([k, v]) => (
                  <View key={k} style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{k.replace(/_/g, ' ')}</Text>
                    <Text style={styles.detailValue}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Static Info Cards */}
        <Text style={styles.sectionTitle}>Informações</Text>

        <View style={styles.infoCard}>
          <View style={styles.infoTitle}>
            <Ionicons name="server" size={20} color="#ff6b00" />
            <Text>Backend</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Framework</Text>
            <Text style={styles.infoValue}>FastAPI 0.115+</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Python</Text>
            <Text style={styles.infoValue}>3.12+</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Database</Text>
            <Text style={styles.infoValue}>SQLite (aiosqlite)</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Auth</Text>
            <Text style={styles.infoValue}>JWT (HS256)</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoTitle}>
            <Ionicons name="construct" size={20} color="#ff6b00" />
            <Text>Hermes Agent</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Versão</Text>
            <Text style={styles.infoValue}>0.22.2</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Protocolo</Text>
            <Text style={styles.infoValue}>WebSocket (/api/pty)</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Toolsets</Text>
            <Text style={styles.infoValue}>terminal, file, web, browser, vision, skills, todo, cronjob, memory</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Personalidade</Text>
            <Text style={styles.infoValue}>ODIN (pt-BR)</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoTitle}>
            <Ionicons name="logo-react" size={20} color="#ff6b00" />
            <Text>Frontend</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Web</Text>
            <Text style={styles.infoValue}>React 18 + TypeScript + Vite</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Mobile</Text>
            <Text style={styles.infoValue}>Expo + React Native + Expo Router</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Styling</Text>
            <Text style={styles.infoValue}>Tailwind CSS (NativeWind)</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>State</Text>
            <Text style={styles.infoValue}>React Context + Hooks</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoTitle}>
            <Ionicons name="key" size={20} color="#ff6b00" />
            <Text>Segurança</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Hermes Token</Text>
            <Text style={styles.infoValue}>Apenas no backend (X-Hermes-Session-Token)</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>JWT Secret</Text>
            <Text style={styles.infoValue}>Armazenado apenas no servidor</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Refresh Token</Text>
            <Text style={styles.infoValue}>HttpOnly cookie / SecureStore (mobile)</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>CORS</Text>
            <Text style={styles.infoValue}>Restrito a origens configuradas</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

import { RefreshControl } from 'react-native'