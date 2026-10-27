import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import * as Updates from 'expo-updates'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { HudScreen } from '../../components/hud/Screen'
import { ScreenHeader } from '../../components/hud/ScreenHeader'
import {
  Badge,
  HudButton,
  Panel,
  PressableScale,
  SectionLabel,
  StatTile,
  type BadgeTone,
} from '../../components/hud/primitives'
import { ServerSettings } from '../../components/hud/ServerSettings'
import { api, getApiBase, type SystemStatus } from '../../lib/api'
import { useAuth } from '../../contexts/AuthContext'
import { alpha, colors, fonts, radius, spacing } from '../../lib/theme'
import { formatDate, formatRelativeTime, getErrorMessage } from '../../lib/utils'

const COMPONENT_ICONS: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  gateway: 'git-network-outline',
  dashboard: 'desktop-outline',
  storage: 'server-outline',
  platforms: 'wifi-outline',
  memory: 'hardware-chip-outline',
  disk: 'save-outline',
  cpu: 'cube-outline',
  hermes: 'sparkles-outline',
  database: 'server-outline',
  api: 'cloud-outline',
}

const INFO_ROWS = [
  { label: 'Cliente', value: 'ODIN Mobile Arm' },
  { label: 'Runtime', value: 'Expo SDK 58 · React Native 0.88' },
  { label: 'Estilo', value: 'Design tokens + StyleSheet' },
  { label: 'Transporte', value: 'REST + WebSocket replay' },
  { label: 'Estado', value: 'React Context + SecureStore' },
  { label: 'Auth', value: 'JWT + refresh token rotativo' },
]

export default function SystemScreen() {
  const { user, refreshUser } = useAuth()
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serverOpen, setServerOpen] = useState(false)
  const [baseUrl, setBaseUrl] = useState(getApiBase())
  const [checkingUpdates, setCheckingUpdates] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)

  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadStatus = useCallback(async () => {
    try {
      const data = await api.getSystemStatus()
      if (!mounted.current) return
      setStatus(data)
      setError(null)
    } catch {
      if (mounted.current) setError('Não foi possível consultar a telemetria do nó.')
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Initial fetch plus polling; data lands after the awaited request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStatus()
    const timer = setInterval(() => {
      void loadStatus()
    }, 20_000)
    return () => clearInterval(timer)
  }, [loadStatus])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadStatus()
    if (mounted.current) setRefreshing(false)
  }

  const handleServerSaved = async (url: string) => {
    setBaseUrl(url)
    setStatus(null)
    setLoading(true)
    setError(null)
    // Switching nodes clears tokens in api.setServerUrl; this signs the user
    // out and sends them back to the login screen against the new backend.
    await refreshUser()
  }

  const handleCheckUpdates = async () => {
    setCheckingUpdates(true)
    setUpdateMessage(null)
    try {
      if (!Updates.isEnabled) {
        setUpdateMessage('OTA indisponível no Expo Go. Instale o APK para receber atualizações.')
        return
      }

      setUpdateMessage('Consultando o canal de atualização…')
      const check = await Updates.checkForUpdateAsync()
      if (!check.isAvailable) {
        setUpdateMessage('Você já está na versão mais recente publicada.')
        return
      }

      setUpdateMessage('Atualização encontrada. Baixando…')
      const fetched = await Updates.fetchUpdateAsync()
      if (fetched.isNew) {
        setUpdateMessage('Atualização aplicada. Reiniciando o app…')
        await Updates.reloadAsync()
      } else {
        setUpdateMessage('Nenhuma atualização nova disponível.')
      }
    } catch (updateError) {
      setUpdateMessage(getErrorMessage(updateError, 'Falha ao verificar atualizações.'))
    } finally {
      setCheckingUpdates(false)
    }
  }

  const isHealthy = status?.overall === 'ok'
  const components = Object.entries(status?.components ?? {})
  const healthyComponents = components.filter(([, component]) => component.status === 'ok').length
  const accent = isHealthy ? colors.successLight : colors.warningLight

  if (loading && !status) {
    return (
      <HudScreen scroll={false}>
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Consultando telemetria…</Text>
        </View>
      </HudScreen>
    )
  }

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
        eyebrow="Diagnóstico do nó"
        title="Telemetria"
        subtitle="Saúde do backend, gateway Hermes e subsistemas reportados em tempo real."
        right={
          <Badge
            label={isHealthy ? 'Saudável' : 'Degradado'}
            tone={isHealthy ? 'success' : 'warning'}
            dot
          />
        }
      />

      <Animated.View entering={FadeInDown.duration(400)}>
        <Panel glow={isHealthy ? 'cyan' : 'orange'} style={styles.overall}>
          <View style={[styles.overallIcon, { borderColor: alpha(accent, 0.32) }]}>
            <Ionicons
              name={isHealthy ? 'checkmark-circle-outline' : 'warning-outline'}
              size={26}
              color={accent}
            />
          </View>
          <View style={styles.overallCopy}>
            <Text style={styles.overallEyebrow}>Nó operacional</Text>
            <Text style={[styles.overallTitle, { color: accent }]}>
              {isHealthy ? 'Todos os sistemas saudáveis' : 'Operação degradada'}
            </Text>
            <Text style={styles.overallMeta}>
              Última verificação {status?.timestamp ? formatRelativeTime(status.timestamp) : '—'}
            </Text>
          </View>
        </Panel>
      </Animated.View>

      <View style={styles.statsRow}>
        <StatTile
          label="Subsistemas"
          value={`${healthyComponents}/${components.length}`}
          tone={healthyComponents === components.length ? 'success' : 'warning'}
        />
        <StatTile
          label="Hermes"
          value={status?.hermes_connected ? 'ON' : 'OFF'}
          tone={status?.hermes_connected ? 'success' : 'danger'}
        />
        <StatTile
          label="Banco"
          value={status?.database_connected ? 'ON' : 'FAIL'}
          tone={status?.database_connected ? 'success' : 'danger'}
        />
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="warning-outline" size={13} color={colors.dangerLight} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionLabel
          title="Subsistemas"
          right={
            <Text style={styles.sectionMeta}>
              v{status?.version ?? '—'}
            </Text>
          }
        />
        {components.length === 0 ? (
          <Panel>
            <Text style={styles.emptyComponents}>Nenhum subsistema reportado pelo backend.</Text>
          </Panel>
        ) : (
          components.map(([name, component], index) => {
            const ok = component.status === 'ok'
            const tone: BadgeTone = ok ? 'success' : 'danger'
            return (
              <Animated.View
                key={name}
                entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(260)}
              >
                <Panel style={styles.componentCard}>
                  <View style={styles.componentHeader}>
                    <View
                      style={[
                        styles.componentIcon,
                        { borderColor: alpha(ok ? colors.success : colors.danger, 0.3) },
                      ]}
                    >
                      <Ionicons
                        name={COMPONENT_ICONS[name.toLowerCase()] ?? 'hardware-chip-outline'}
                        size={16}
                        color={ok ? colors.successLight : colors.dangerLight}
                      />
                    </View>
                    <View style={styles.componentCopy}>
                      <Text style={styles.componentName}>{name}</Text>
                      <Text style={styles.componentMeta}>
                        {component.details && Object.keys(component.details).length > 0
                          ? `${Object.keys(component.details).length} métricas`
                          : 'Sem detalhes adicionais'}
                      </Text>
                    </View>
                    <Badge label={component.status} tone={tone} dot />
                  </View>

                  {component.details && Object.keys(component.details).length > 0 ? (
                    <View style={styles.detailList}>
                      {Object.entries(component.details).slice(0, 6).map(([key, value]) => (
                        <View key={key} style={styles.detailRow}>
                          <Text style={styles.detailLabel}>{key.replace(/_/g, ' ')}</Text>
                          <Text style={styles.detailValue} numberOfLines={1}>
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Panel>
              </Animated.View>
            )
          })
        )}
      </View>

      <View style={styles.section}>
        <SectionLabel title="Sessão e cliente" />
        <Panel>
          {user?.email ? (
            <View style={styles.userRow}>
              <View style={styles.userAvatar}>
                <Ionicons name="person-outline" size={15} color={colors.primaryLight} />
              </View>
              <View style={styles.userCopy}>
                <Text style={styles.userEmail} numberOfLines={1}>
                  {user.email}
                </Text>
                <Text style={styles.userMeta}>
                  {user.is_superuser ? 'Operador root' : 'Operador'} · desde{' '}
                  {formatDate(user.created_at)}
                </Text>
              </View>
              <Badge label="Sessão ativa" tone="success" dot />
            </View>
          ) : null}
          {INFO_ROWS.map((row, index) => (
            <View
              key={row.label}
              style={[styles.infoRow, index > 0 && styles.infoRowBorder]}
            >
              <Text style={styles.infoLabel}>{row.label}</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {row.value}
              </Text>
            </View>
          ))}
        </Panel>
      </View>

      <View style={styles.section}>
        <SectionLabel
          title="Atualizações OTA"
          right={
            <Badge
              label={Updates.isEnabled ? 'Ativo' : 'Indisponível'}
              tone={Updates.isEnabled ? 'success' : 'neutral'}
              dot
            />
          }
        />
        <Panel>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Versão do app</Text>
            <Text style={styles.infoValue}>{Constants.expoConfig?.version ?? '—'}</Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>Runtime</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {Updates.runtimeVersion ?? '—'}
            </Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>Canal</Text>
            <Text style={styles.infoValue}>{Updates.channel || '—'}</Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>Update ID</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {Updates.updateId ? Updates.updateId.slice(0, 12) : 'embutido no APK'}
            </Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>Publicado</Text>
            <Text style={styles.infoValue}>
              {Updates.createdAt ? formatDate(Updates.createdAt) : '—'}
            </Text>
          </View>

          {updateMessage ? (
            <View style={styles.updateMessage}>
              <Ionicons name="information-circle-outline" size={13} color={colors.cyan} />
              <Text style={styles.updateMessageText}>{updateMessage}</Text>
            </View>
          ) : null}

          <HudButton
            label={checkingUpdates ? 'Verificando…' : 'Verificar atualização'}
            icon="cloud-download-outline"
            variant="cyan"
            size="sm"
            fullWidth
            loading={checkingUpdates}
            disabled={!Updates.isEnabled}
            onPress={() => void handleCheckUpdates()}
            style={styles.updateButton}
          />
          <Text style={styles.updateNote}>
            O APK verifica updates automaticamente ao abrir. Apenas o bundle JS é trocado —
            mudanças nativas exigem um novo build.
          </Text>
        </Panel>
      </View>

      <View style={styles.section}>
        <SectionLabel title="Rede e segurança" />
        <Panel>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Endpoint API</Text>
            <PressableScale
              onPress={() => setServerOpen(true)}
              accessibilityLabel="Alterar endpoint da API"
              style={styles.endpointPressable}
            >
              <View style={styles.endpointRow}>
                <Text style={styles.endpointValue} numberOfLines={1}>
                  {baseUrl.replace(/^https?:\/\//, '')}
                </Text>
                <Ionicons name="create-outline" size={12} color={colors.primaryLight} />
              </View>
            </PressableScale>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>Refresh token</Text>
            <Text style={styles.infoValue}>SecureStore (dispositivo)</Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>Hermes token</Text>
            <Text style={styles.infoValue}>Somente no backend</Text>
          </View>
          <View style={[styles.infoRow, styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>Stream</Text>
            <Text style={styles.infoValue}>WebSocket replay · seq</Text>
          </View>
          <View style={styles.securityNote}>
            <Ionicons name="shield-checkmark-outline" size={13} color={colors.successLight} />
            <Text style={styles.securityText}>
              Credenciais sensíveis nunca trafegam para o cliente mobile.
            </Text>
          </View>
        </Panel>
      </View>

      <View style={styles.footer}>
        <Ionicons name="pulse-outline" size={12} color={colors.faint} />
        <Text style={styles.footerText}>
          ODIN V2 · {status?.version ? `CORE ${status.version}` : 'CORE'} · MOBILE ARM
        </Text>
      </View>

      {serverOpen ? (
        <ServerSettings
          onClose={() => setServerOpen(false)}
          onSaved={(url) => void handleServerSaved(url)}
        />
      ) : null}
    </HudScreen>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
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
  overall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  overallIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: alpha(colors.bg, 0.45),
  },
  overallCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  overallEyebrow: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  overallTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  overallMeta: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.dangerLight,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionMeta: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.5,
    color: colors.faint,
  },
  emptyComponents: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.dim,
  },
  componentCard: {
    marginBottom: spacing.xs,
    gap: spacing.xs,
  },
  componentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  componentIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: alpha(colors.bg, 0.45),
  },
  componentCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  componentName: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    color: colors.text,
    textTransform: 'capitalize',
  },
  componentMeta: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
  },
  detailList: {
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  detailLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
    textTransform: 'lowercase',
  },
  detailValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.textSoft,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    marginBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  userAvatar: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.28),
    backgroundColor: alpha(colors.primary, 0.08),
  },
  userCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  userEmail: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.text,
  },
  userMeta: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  infoRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  infoLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.5,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.textSoft,
  },
  endpointPressable: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
  },
  endpointValue: {
    flexShrink: 1,
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.textSoft,
    textAlign: 'right',
  },
  updateMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  updateMessageText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
    color: colors.cyan,
  },
  updateButton: {
    marginTop: spacing.sm,
  },
  updateNote: {
    marginTop: spacing.xs,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 14,
    color: colors.dim,
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  securityText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 9,
    lineHeight: 14,
    color: colors.dim,
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
    letterSpacing: 0.8,
    color: colors.faint,
  },
})
