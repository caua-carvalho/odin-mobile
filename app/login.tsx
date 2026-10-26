import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useAuth } from '../contexts/AuthContext'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center', paddingHorizontal: 24 },
  logo: { alignItems: 'center', marginBottom: 40 },
  logoIcon: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#ff6b00', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  logoText: { fontSize: 32, fontWeight: '700', color: '#ff6b00', letterSpacing: 2 },
  subtitle: { color: '#686868', fontSize: 16 },
  form: { width: '100%', gap: 16 },
  inputGroup: { gap: 8 },
  label: { color: '#a8a8a8', fontSize: 13, fontWeight: '600' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#181818', borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: '#282828' },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#fff', fontSize: 16, paddingVertical: 14 },
  eyeBtn: { padding: 4 },
  errorText: { color: '#e05600', fontSize: 12 },
  submitBtn: { marginTop: 8, backgroundColor: '#ff6b00', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#ff6b0080' },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loadingSpinner: { marginRight: 8 },
  footer: { marginTop: 32, alignItems: 'center' },
  footerText: { color: '#505050', fontSize: 13 },
})

export default function LoginScreen() {
  const router = useRouter()
  const { login, loading: authLoading } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Preencha todos os campos')
      return
    }

    setError('')
    setLoading(true)

    try {
      await login(email, password)
      router.replace('/(tabs)')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao fazer login. Verifique suas credenciais.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={0}
    >
      <View style={styles.logo}>
        <View style={styles.logoIcon}>
          <Ionicons name="construct" size={40} color="#0a0a0a" />
        </View>
        <Text style={styles.logoText}>ODIN V2</Text>
        <Text style={styles.subtitle}>Assistente Pessoal de IA</Text>
      </View>

      <View style={styles.form}>
        {error && (
          <View style={{ backgroundColor: '#e0560020', borderWidth: 1, borderColor: '#e0560040', borderRadius: 8, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="alert-circle" size={20} color="#e05600" />
            <Text style={{ color: '#e05600', fontSize: 13, flex: 1 }}>{error}</Text>
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail" size={22} color="#686868" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="seu@email.com"
              placeholderTextColor="#686868"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              editable={!loading && !authLoading}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed" size={22} color="#686868" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#686868"
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              editable={!loading && !authLoading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={22} color="#686868" />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.submitBtn, (loading || authLoading) && styles.submitBtnDisabled]}
          disabled={loading || authLoading}
        >
          {loading || authLoading ? (
            <>
              <ActivityIndicator size="small" color="#fff" style={styles.loadingSpinner} />
              <Text style={styles.submitBtnText}>Entrando...</Text>
            </>
          ) : (
            <Text style={styles.submitBtnText}>Entrar</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>ODIN V2 — Assistente Pessoal de IA</Text>
      </View>
    </KeyboardAvoidingView>
  )
}