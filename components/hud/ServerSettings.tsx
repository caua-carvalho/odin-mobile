import React, { useState } from 'react'
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import axios from 'axios'
import { api, getApiBase } from '../../lib/api'
import {
  defaultServerUrl,
  isServerExplicitlyConfigured,
  normalizeServerUrl,
} from '../../lib/serverConfig'
import { alpha, colors, fonts, radius, spacing } from '../../lib/theme'
import { HudButton, Panel, PressableScale } from './primitives'

interface ServerSettingsProps {
  onClose: () => void
  onSaved?: (url: string) => void
}

type MessageTone = 'error' | 'success' | 'info'

interface Message {
  tone: MessageTone
  text: string
}

const TONE_COLORS: Record<MessageTone, string> = {
  error: colors.dangerLight,
  success: colors.successLight,
  info: colors.cyan,
}

export function ServerSettings({ onClose, onSaved }: ServerSettingsProps) {
  const insets = useSafeAreaInsets()
  const [value, setValue] = useState(getApiBase())
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  const normalized = normalizeServerUrl(value)
  const busy = testing || saving
  const canUseDefault = isServerExplicitlyConfigured()

  const handleTest = async () => {
    if (!normalized) {
      setMessage({ tone: 'error', text: 'Endereço inválido. Ex.: http://192.168.1.50:8000/api' })
      return
    }

    setTesting(true)
    setMessage({ tone: 'info', text: 'Consultando /health…' })
    try {
      const response = await axios.get<{ ok?: boolean; version?: string }>(
        `${normalized}/health`,
        { timeout: 8_000 },
      )
      setMessage({
        tone: 'success',
        text: response.data?.version
          ? `Conexão OK · core ${response.data.version}`
          : 'Conexão OK · backend respondeu.',
      })
    } catch {
      setMessage({
        tone: 'error',
        text: 'Backend inacessível. Confira IP, porta, firewall e se o uvicorn está em 0.0.0.0.',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!normalized) {
      setMessage({ tone: 'error', text: 'Endereço inválido. Ex.: http://192.168.1.50:8000/api' })
      return
    }

    setSaving(true)
    try {
      const saved = await api.setServerUrl(normalized)
      onSaved?.(saved)
      onClose()
    } catch (error) {
      setMessage({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível salvar o servidor.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDefault = () => {
    setValue(defaultServerUrl())
    setMessage({ tone: 'info', text: 'Endereço padrão do ambiente carregado. Teste a conexão antes de salvar.' })
  }

  return (
    <Modal
      visible
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.backdrop}
      >
        <Pressable
          onPress={onClose}
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Fechar configuração de servidor"
        >
          <View style={styles.backdropFill} />
        </Pressable>

        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <Panel glow="orange" style={styles.panel}>
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="server-outline" size={18} color={colors.primaryLight} />
              </View>
              <View style={styles.headerCopy}>
                <Text style={styles.headerEyebrow}>CONEXÃO DO NÓ</Text>
                <Text style={styles.headerTitle}>Servidor ODIN</Text>
              </View>
              <PressableScale
                onPress={onClose}
                accessibilityLabel="Fechar"
                hitSlop={10}
              >
                <Ionicons name="close-outline" size={21} color={colors.muted} />
              </PressableScale>
            </View>

            <Text style={styles.description}>
              Defina o endereço do backend. O valor fica salvo no SecureStore e pode ser
              alterado depois, sem gerar um novo APK.
            </Text>

            <Text style={styles.fieldLabel}>Endpoint da API</Text>
            <View style={styles.inputShell}>
              <Ionicons name="globe-outline" size={17} color={colors.dim} />
              <TextInput
                value={value}
                onChangeText={(next) => {
                  setValue(next)
                  setMessage(null)
                }}
                placeholder="http://192.168.1.50:8000/api"
                placeholderTextColor={colors.dim}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={() => void handleSave()}
                editable={!busy}
                selectionColor={colors.primary}
                style={styles.input}
              />
            </View>
            <Text style={styles.hint}>
              Aceita IP, hostname ou domínio. Sem caminho, usamos <Text style={styles.hintMono}>/api</Text>.
            </Text>

            {message ? (
              <View style={[styles.messageBox, { borderColor: alpha(TONE_COLORS[message.tone], 0.35) }]}>
                <Ionicons
                  name={
                    message.tone === 'success'
                      ? 'checkmark-circle-outline'
                      : message.tone === 'info'
                        ? 'sync-outline'
                        : 'warning-outline'
                  }
                  size={14}
                  color={TONE_COLORS[message.tone]}
                />
                <Text style={[styles.messageText, { color: TONE_COLORS[message.tone] }]}>
                  {message.text}
                </Text>
              </View>
            ) : null}

            <View style={styles.actions}>
              <HudButton
                label="Testar"
                icon="pulse-outline"
                variant="secondary"
                size="md"
                onPress={() => void handleTest()}
                loading={testing}
                disabled={saving}
                style={styles.actionButton}
              />
              <HudButton
                label="Salvar servidor"
                icon="save-outline"
                size="md"
                onPress={() => void handleSave()}
                loading={saving}
                disabled={testing}
                style={styles.actionButton}
              />
            </View>

            <View style={styles.footer}>
              {canUseDefault ? (
                <PressableScale
                  onPress={handleDefault}
                  haptic="selection"
                  accessibilityLabel="Usar endereço padrão"
                >
                  <Text style={styles.footerLink}>Usar padrão do ambiente</Text>
                </PressableScale>
              ) : (
                <Text style={styles.footerMeta}>Sem sugestão automática neste build</Text>
              )}
              <Text style={styles.footerMeta}>Salvo localmente · SecureStore</Text>
            </View>
          </Panel>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropFill: {
    flex: 1,
    backgroundColor: alpha(colors.bg, 0.82),
  },
  sheet: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  panel: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    padding: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.32),
    backgroundColor: alpha(colors.primary, 0.1),
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  headerEyebrow: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.6,
    color: colors.primaryLight,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 18,
    letterSpacing: -0.3,
    color: colors.text,
  },
  description: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  fieldLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    letterSpacing: 1.4,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: alpha(colors.bg, 0.72),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.5),
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.text,
    paddingVertical: 0,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 15,
    color: colors.dim,
    marginTop: 6,
  },
  hintMono: {
    fontFamily: fonts.mono,
    color: colors.textSoft,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: alpha(colors.bg, 0.45),
  },
  messageText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerLink: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.primaryLight,
  },
  footerMeta: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.faint,
  },
})
