import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { Redirect, useRouter } from 'expo-router'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { useAuth } from '../contexts/AuthContext'
import { AgentOrb } from '../components/orb/AgentOrb'
import { HudBackdrop } from '../components/hud/Backdrop'
import { HudButton, Panel, PressableScale } from '../components/hud/primitives'
import { ServerSettings } from '../components/hud/ServerSettings'
import { getApiBase, isServerConfigured } from '../lib/api'
import { getErrorMessage } from '../lib/utils'
import { alpha, colors, fonts, radius, spacing } from '../lib/theme'

interface FieldProps {
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  secure?: boolean
  keyboardType?: 'default' | 'email-address'
  autoComplete?: 'email' | 'current-password'
  returnKeyType?: 'next' | 'go'
  onSubmitEditing?: () => void
  editable?: boolean
  trailing?: React.ReactNode
}

function Field({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secure = false,
  keyboardType = 'default',
  autoComplete,
  returnKeyType,
  onSubmitEditing,
  editable = true,
  trailing,
}: FieldProps) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputShell, focused && styles.inputShellFocused]}>
        <Ionicons name={icon} size={17} color={focused ? colors.primary : colors.dim} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.dim}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={styles.input}
          selectionColor={colors.primary}
        />
        {trailing}
      </View>
    </View>
  )
}

export default function LoginScreen() {
  const router = useRouter()
  const { user, login, loading: authLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverOpen, setServerOpen] = useState(!isServerConfigured())
  const [serverConfigured, setServerConfigured] = useState(isServerConfigured())
  const [serverUrl, setServerUrl] = useState(getApiBase())

  if (user) return <Redirect href="/(tabs)" />

  const busy = submitting || authLoading

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Informe suas credenciais para abrir o núcleo.')
      return
    }

    setError('')
    setSubmitting(true)
    try {
      await login(email.trim(), password)
      router.replace('/(tabs)')
    } catch (err) {
      setError(getErrorMessage(err, 'Credenciais inválidas. Verifique email e senha.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <HudBackdrop />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(500)} style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Ionicons name="scan-outline" size={19} color={colors.bg} />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>ODIN V2</Text>
              <Text style={styles.brandMeta}>NEURAL COMMAND INTERFACE</Text>
            </View>
            <View style={styles.versionChip}>
              <Text style={styles.versionText}>v0.2</Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).duration(600)} style={styles.hero}>
            <AgentOrb state={busy ? 'connecting' : 'idle'} size={168} label="Núcleo ODIN" />
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>ACESSO AO NÚCLEO</Text>
              <Text style={styles.heroTitle}>Bem-vindo de volta.</Text>
              <Text style={styles.heroSubtitle}>
                Autentique-se para sincronizar conversas, execuções e autorizações com o seu nó ODIN.
              </Text>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(150).duration(500)} style={styles.formWrap}>
            <Panel glow="orange" style={styles.formPanel}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>SESSÃO OPERACIONAL</Text>
                <View style={styles.secureRow}>
                  <View style={styles.secureDot} />
                  <Text style={styles.secureText}>CRIPTOGRAFADA</Text>
                </View>
              </View>

              {!serverConfigured ? (
                <PressableScale
                  onPress={() => setServerOpen(true)}
                  accessibilityLabel="Configurar servidor do ODIN"
                >
                  <View style={styles.serverWarning}>
                    <Ionicons name="server-outline" size={15} color={colors.warningLight} />
                    <Text style={styles.serverWarningText}>
                      Servidor não configurado. Toque para informar o endereço do backend.
                    </Text>
                    <Ionicons name="chevron-forward-outline" size={14} color={colors.warningLight} />
                  </View>
                </PressableScale>
              ) : null}

              {error ? (
                <View style={styles.errorBox}>
                  <Ionicons name="warning-outline" size={16} color={colors.dangerLight} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Field
                label="Email"
                icon="mail-outline"
                value={email}
                onChangeText={setEmail}
                placeholder="operador@odin.ai"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
                editable={!busy}
              />

              <Field
                label="Senha"
                icon="lock-closed-outline"
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secure={!showPassword}
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={() => void handleSubmit()}
                editable={!busy}
                trailing={
                  <PressableScale
                    onPress={() => setShowPassword((previous) => !previous)}
                    haptic="selection"
                    accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    hitSlop={10}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color={colors.muted}
                    />
                  </PressableScale>
                }
              />

              <HudButton
                label={busy ? 'Abrindo núcleo…' : 'Acessar núcleo'}
                icon={busy ? undefined : 'enter-outline'}
                onPress={() => void handleSubmit()}
                loading={busy}
                size="lg"
                fullWidth
                style={styles.submit}
              />

              <View style={styles.formFooter}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.dim} />
                <Text style={styles.formFooterText}>JWT + SecureStore · sessão renovada automaticamente</Text>
              </View>
            </Panel>

            <View style={styles.networkRow}>
              <PressableScale
                onPress={() => setServerOpen(true)}
                accessibilityLabel="Alterar servidor do ODIN"
              >
                <View style={styles.networkPill}>
                  <Ionicons name="server-outline" size={11} color={colors.faint} />
                  <Text style={styles.networkLabel}>NÓ</Text>
                  <Text style={styles.networkValue} numberOfLines={1}>
                    {serverUrl.replace(/^https?:\/\//, '')}
                  </Text>
                  <Ionicons name="create-outline" size={12} color={colors.primaryLight} />
                </View>
              </PressableScale>
            </View>

            {__DEV__ ? (
              <Text style={styles.devHint}>Expo Go · servidor configurável no app</Text>
            ) : null}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      {serverOpen ? (
        <ServerSettings
          onClose={() => setServerOpen(false)}
          onSaved={(url) => {
            setServerUrl(url)
            setServerConfigured(true)
            setError('')
          }}
        />
      ) : null}

      {busy ? (
        <View pointerEvents="none" style={styles.busyOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.busyText}>AUTENTICANDO</Text>
        </View>
      ) : null}
    </SafeAreaView>
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
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  brandCopy: {
    flex: 1,
    gap: 2,
  },
  brandName: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    letterSpacing: 2.2,
    color: colors.text,
  },
  brandMeta: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1.6,
    color: colors.dim,
  },
  versionChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: alpha(colors.elevated, 0.7),
  },
  versionText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.muted,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroCopy: {
    alignItems: 'center',
    marginTop: spacing.xs,
    maxWidth: 330,
  },
  heroEyebrow: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    letterSpacing: 2.4,
    color: colors.primaryLight,
    marginBottom: 6,
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 27,
    letterSpacing: -0.9,
    color: colors.text,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  formWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  formPanel: {
    padding: spacing.lg,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  formTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.textSoft,
  },
  serverWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: alpha(colors.warning, 0.09),
    borderWidth: 1,
    borderColor: alpha(colors.warning, 0.32),
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  serverWarningText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    color: colors.warningLight,
  },
  secureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  secureDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  secureText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.8,
    color: colors.successLight,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: alpha(colors.danger, 0.1),
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.3),
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 17,
    color: colors.dangerLight,
  },
  fieldGroup: {
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
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  inputShellFocused: {
    borderColor: alpha(colors.primary, 0.7),
    backgroundColor: alpha(colors.primary, 0.045),
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    paddingVertical: 0,
  },
  submit: {
    marginTop: spacing.xs,
  },
  formFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
  },
  formFooterText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 0.3,
    color: colors.dim,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.6),
    maxWidth: 320,
  },
  networkLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.2,
    color: colors.faint,
  },
  networkValue: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.dim,
    maxWidth: 260,
  },
  devHint: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.faint,
    textAlign: 'center',
    marginTop: 4,
  },
  busyOverlay: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: alpha(colors.surface, 0.92),
    borderWidth: 1,
    borderColor: alpha(colors.primary, 0.25),
  },
  busyText: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.primaryLight,
  },
})
