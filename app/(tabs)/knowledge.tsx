import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { HudScreen } from '../../components/hud/Screen'
import { ScreenHeader } from '../../components/hud/ScreenHeader'
import {
  Badge,
  EmptyState,
  Panel,
  PressableScale,
  type BadgeTone,
} from '../../components/hud/primitives'
import { api, type KnowledgeItem } from '../../lib/api'
import { useOdinStatus } from '../../contexts/OdinStatusContext'
import { alpha, colors, fonts, radius, spacing } from '../../lib/theme'
import { formatRelativeTime, getErrorMessage, pluralize } from '../../lib/utils'

const KNOWLEDGE_TYPES = [
  { value: 'note', label: 'Nota', icon: 'document-text-outline', tone: 'primary' },
  { value: 'link', label: 'Link', icon: 'link-outline', tone: 'cyan' },
  { value: 'snippet', label: 'Trecho', icon: 'code-slash-outline', tone: 'warning' },
  { value: 'personal', label: 'Pessoal', icon: 'person-outline', tone: 'success' },
] as const

type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number]['value']

function typeMeta(type: string) {
  return KNOWLEDGE_TYPES.find((item) => item.value === type) ?? KNOWLEDGE_TYPES[0]
}

interface FormState {
  type: KnowledgeType
  title: string
  content: string
  url: string
  tags: string
}

const EMPTY_FORM: FormState = {
  type: 'note',
  title: '',
  content: '',
  url: '',
  tags: '',
}

export default function KnowledgeScreen() {
  const insets = useSafeAreaInsets()
  const { refresh: refreshStatus } = useOdinStatus()

  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const loadItems = useCallback(async () => {
    try {
      const data = await api.listKnowledge({
        page_size: 50,
        q: search.trim() || undefined,
        type: typeFilter || undefined,
      })
      if (!mounted.current) return
      setItems(data.items)
      setTotal(data.total)
      setError(null)
    } catch (err) {
      if (mounted.current) setError(getErrorMessage(err, 'Erro ao carregar a biblioteca.'))
    } finally {
      if (mounted.current) setLoading(false)
    }
  }, [search, typeFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadItems()
    }, 280)
    return () => clearTimeout(timer)
  }, [loadItems])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadItems()
    if (mounted.current) setRefreshing(false)
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setFormErrors({})
    setEditingItem(null)
  }

  const openCreate = () => {
    resetForm()
    setShowModal(true)
  }

  const openEdit = (item: KnowledgeItem) => {
    setEditingItem(item)
    setForm({
      type: item.type,
      title: item.title,
      content: item.content,
      url: item.url || '',
      tags: item.tags.join(', '),
    })
    setFormErrors({})
    setShowModal(true)
  }

  const closeModal = () => {
    if (submitting) return
    setShowModal(false)
    resetForm()
  }

  const validateForm = () => {
    const nextErrors: Record<string, string> = {}
    if (!form.title.trim()) nextErrors.title = 'Informe um título.'
    if (!form.content.trim()) nextErrors.content = 'Informe o conteúdo.'
    if (form.type === 'link' && form.url.trim() && !isValidUrl(form.url.trim())) {
      nextErrors.url = 'URL inválida.'
    }
    setFormErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async () => {
    if (submitting || !validateForm()) return
    setSubmitting(true)
    setFormErrors({})
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        content: form.content.trim(),
        url: form.type === 'link' && form.url.trim() ? form.url.trim() : undefined,
        tags: form.tags
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean),
      }

      if (editingItem) {
        await api.updateKnowledge(editingItem.id, payload)
      } else {
        await api.createKnowledge(payload)
      }

      setShowModal(false)
      resetForm()
      await loadItems()
      void refreshStatus()
    } catch (err) {
      if (mounted.current) {
        setFormErrors({ submit: getErrorMessage(err, 'Não foi possível salvar o item.') })
      }
    } finally {
      if (mounted.current) setSubmitting(false)
    }
  }

  const handleDelete = (item: KnowledgeItem) => {
    Alert.alert('Excluir item', `Remover "${item.title}" da biblioteca?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await api.deleteKnowledge(item.id)
              setItems((previous) => previous.filter((entry) => entry.id !== item.id))
              setTotal((previous) => Math.max(0, previous - 1))
              void refreshStatus()
            } catch (err) {
              Alert.alert('Falha', getErrorMessage(err, 'Não foi possível excluir o item.'))
            }
          })()
        },
      },
    ])
  }

  const showInitialLoading = loading && items.length === 0

  return (
    <HudScreen scroll={false}>
      <ScreenHeader
        eyebrow="Base de conhecimento"
        title="Biblioteca"
        subtitle="Notas, links e trechos indexados que alimentam o contexto do ODIN."
        right={
          <PressableScale
            accessibilityLabel="Criar item na biblioteca"
            haptic="medium"
            onPress={openCreate}
          >
            <View style={styles.addButton}>
              <Ionicons name="add" size={21} color={colors.bg} />
            </View>
          </PressableScale>
        }
      />

      <View style={styles.searchWrap}>
        <View style={styles.searchShell}>
          <Ionicons name="search-outline" size={16} color={colors.dim} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Buscar por título, conteúdo ou tag…"
            placeholderTextColor={colors.dim}
            style={styles.searchInput}
            selectionColor={colors.primary}
            returnKeyType="search"
            autoCapitalize="none"
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.faint} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.filterWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <FilterChip
            label="Todos"
            icon="apps-outline"
            active={!typeFilter}
            onPress={() => setTypeFilter('')}
          />
          {KNOWLEDGE_TYPES.map((type) => (
            <FilterChip
              key={type.value}
              label={type.label}
              icon={type.icon}
              active={typeFilter === type.value}
              onPress={() => setTypeFilter((previous) => (previous === type.value ? '' : type.value))}
            />
          ))}
        </ScrollView>
      </View>

      {error ? (
        <View style={styles.errorRow}>
          <Ionicons name="warning-outline" size={13} color={colors.dangerLight} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {showInitialLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Indexando biblioteca…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void handleRefresh()}
              tintColor={colors.primary}
              colors={[colors.primary]}
              progressBackgroundColor={colors.elevated}
            />
          }
          ListHeaderComponent={
            items.length > 0 ? (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>
                  {total} {pluralize(total, 'registro indexado', 'registros indexados')}
                </Text>
                <View style={styles.listHeaderLine} />
              </View>
            ) : undefined
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 35).duration(260)}>
              <KnowledgeCard
                item={item}
                onEdit={() => openEdit(item)}
                onDelete={() => handleDelete(item)}
              />
            </Animated.View>
          )}
          ListEmptyComponent={
            <EmptyState
              icon="library-outline"
              title={search || typeFilter ? 'Nenhum resultado' : 'Biblioteca vazia'}
              description={
                search || typeFilter
                  ? 'Ajuste a busca ou os filtros para encontrar o que procura.'
                  : 'Adicione notas, links e trechos para dar contexto ao seu nó neural.'
              }
              action={
                !search && !typeFilter ? (
                  <PressableScale
                    accessibilityLabel="Criar primeiro item"
                    haptic="medium"
                    onPress={openCreate}
                  >
                    <View style={styles.emptyAction}>
                      <Ionicons name="add" size={15} color={colors.bg} />
                      <Text style={styles.emptyActionText}>Criar primeiro item</Text>
                    </View>
                  </PressableScale>
                ) : undefined
              }
            />
          }
        />
      )}

      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={closeModal} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheetShell}
          >
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetEyebrow}>
                    {editingItem ? 'Atualizar registro' : 'Novo registro'}
                  </Text>
                  <Text style={styles.sheetTitle}>
                    {editingItem ? 'Editar item' : 'Adicionar à biblioteca'}
                  </Text>
                </View>
                <PressableScale
                  accessibilityLabel="Fechar"
                  haptic="selection"
                  onPress={closeModal}
                >
                  <View style={styles.sheetClose}>
                    <Ionicons name="close" size={19} color={colors.muted} />
                  </View>
                </PressableScale>
              </View>

              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.fieldLabel}>Tipo</Text>
                <View style={styles.typeSelector}>
                  {KNOWLEDGE_TYPES.map((type) => {
                    const active = form.type === type.value
                    return (
                      <PressableScale
                        key={type.value}
                        accessibilityLabel={`Tipo ${type.label}`}
                        haptic="selection"
                        disabled={Boolean(editingItem)}
                        onPress={() =>
                          setForm((previous) => ({ ...previous, type: type.value }))
                        }
                        style={styles.typePress}
                      >
                        <View
                          style={[
                            styles.typeOption,
                            active && styles.typeOptionActive,
                            editingItem && !active && styles.typeOptionMuted,
                          ]}
                        >
                          <Ionicons
                            name={type.icon}
                            size={14}
                            color={active ? colors.bg : colors.muted}
                          />
                          <Text
                            style={[
                              styles.typeOptionText,
                              active && styles.typeOptionTextActive,
                            ]}
                          >
                            {type.label}
                          </Text>
                        </View>
                      </PressableScale>
                    )
                  })}
                </View>

                <FormField
                  label="Título"
                  required
                  value={form.title}
                  onChangeText={(value) => setForm((previous) => ({ ...previous, title: value }))}
                  placeholder="Um título claro para o registro"
                  error={formErrors.title}
                  maxLength={120}
                />

                <FormField
                  label="Conteúdo"
                  required
                  value={form.content}
                  onChangeText={(value) => setForm((previous) => ({ ...previous, content: value }))}
                  placeholder="Cole a nota, o trecho ou o contexto que o ODIN deve conhecer…"
                  error={formErrors.content}
                  multiline
                  maxLength={8000}
                />

                {form.type === 'link' ? (
                  <FormField
                    label="URL"
                    value={form.url}
                    onChangeText={(value) => setForm((previous) => ({ ...previous, url: value }))}
                    placeholder="https://exemplo.com"
                    error={formErrors.url}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                ) : null}

                <FormField
                  label="Tags"
                  value={form.tags}
                  onChangeText={(value) => setForm((previous) => ({ ...previous, tags: value }))}
                  placeholder="trabalho, ideia, referência"
                  hint="Separe as tags por vírgula."
                  autoCapitalize="none"
                />

                {formErrors.submit ? (
                  <View style={styles.submitError}>
                    <Ionicons name="warning-outline" size={13} color={colors.dangerLight} />
                    <Text style={styles.submitErrorText}>{formErrors.submit}</Text>
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.sheetActions}>
                <PressableScale
                  accessibilityLabel="Cancelar"
                  haptic="selection"
                  onPress={closeModal}
                  style={styles.cancelPress}
                >
                  <View style={styles.cancelButton}>
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </View>
                </PressableScale>
                <PressableScale
                  accessibilityLabel={editingItem ? 'Salvar alterações' : 'Criar item'}
                  haptic="medium"
                  onPress={() => void handleSubmit()}
                  disabled={submitting}
                  style={styles.savePress}
                >
                  <View style={[styles.saveButton, submitting && { opacity: 0.6 }]}>
                    {submitting ? (
                      <ActivityIndicator size="small" color={colors.bg} />
                    ) : (
                      <Ionicons
                        name={editingItem ? 'checkmark' : 'add'}
                        size={16}
                        color={colors.bg}
                      />
                    )}
                    <Text style={styles.saveButtonText}>
                      {submitting ? 'Salvando…' : editingItem ? 'Salvar' : 'Criar'}
                    </Text>
                  </View>
                </PressableScale>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </HudScreen>
  )
}

function FilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string
  icon: React.ComponentProps<typeof Ionicons>['name']
  active: boolean
  onPress: () => void
}) {
  return (
    <PressableScale accessibilityLabel={`Filtrar por ${label}`} haptic="selection" onPress={onPress}>
      <View style={[styles.filterChip, active && styles.filterChipActive]}>
        <Ionicons name={icon} size={13} color={active ? colors.bg : colors.muted} />
        <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
      </View>
    </PressableScale>
  )
}

function KnowledgeCard({
  item,
  onEdit,
  onDelete,
}: {
  item: KnowledgeItem
  onEdit: () => void
  onDelete: () => void
}) {
  const meta = typeMeta(item.type)
  return (
    <Panel style={styles.card}>
      <View style={styles.cardHeader}>
        <Badge label={meta.label} tone={meta.tone as BadgeTone} icon={meta.icon} />
        <View style={styles.cardActions}>
          <PressableScale accessibilityLabel="Editar item" haptic="selection" onPress={onEdit}>
            <View style={styles.cardAction}>
              <Ionicons name="create-outline" size={16} color={colors.muted} />
            </View>
          </PressableScale>
          <PressableScale accessibilityLabel="Excluir item" haptic="light" onPress={onDelete}>
            <View style={styles.cardAction}>
              <Ionicons name="trash-outline" size={15} color={colors.dangerLight} />
            </View>
          </PressableScale>
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.cardContent} numberOfLines={3}>
        {item.content}
      </Text>

      {item.url ? (
        <View style={styles.cardUrlRow}>
          <Ionicons name="link-outline" size={12} color={colors.cyan} />
          <Text style={styles.cardUrl} numberOfLines={1}>
            {item.url}
          </Text>
        </View>
      ) : null}

      {item.tags.length > 0 ? (
        <View style={styles.tagRow}>
          {item.tags.slice(0, 5).map((tag) => (
            <View key={tag} style={styles.tag}>
              <Text style={styles.tagText}>#{tag}</Text>
            </View>
          ))}
          {item.tags.length > 5 ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>+{item.tags.length - 5}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        <Ionicons name="time-outline" size={11} color={colors.faint} />
        <Text style={styles.cardDate}>
          {formatRelativeTime(item.updated_at || item.created_at)}
        </Text>
      </View>
    </Panel>
  )
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  hint,
  required = false,
  multiline = false,
  maxLength,
  keyboardType,
  autoCapitalize,
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  error?: string
  hint?: string
  required?: boolean
  multiline?: boolean
  maxLength?: number
  keyboardType?: 'default' | 'url'
  autoCapitalize?: 'none' | 'sentences'
}) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>{label}</Text>
        {required ? <Text style={styles.required}>*</Text> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.dim}
        style={[
          styles.fieldInput,
          multiline && styles.fieldInputMultiline,
          focused && styles.fieldInputFocused,
          error && styles.fieldInputError,
        ]}
        multiline={multiline}
        maxLength={maxLength}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        selectionColor={colors.primary}
        textAlignVertical={multiline ? 'top' : 'center'}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  )
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const styles = StyleSheet.create({
  addButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  searchWrap: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  searchShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 42,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.surface, 0.9),
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.text,
    paddingVertical: 0,
  },
  filterWrap: {
    marginBottom: spacing.sm,
  },
  filterRow: {
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.55),
  },
  filterChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterChipText: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  filterChipTextActive: {
    color: colors.bg,
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
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    flexGrow: 1,
  },
  list: {
    flex: 1,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  listHeaderText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    letterSpacing: 1,
    color: colors.dim,
    textTransform: 'uppercase',
  },
  listHeaderLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  card: {
    marginBottom: spacing.sm,
    gap: 7,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 4,
  },
  cardAction: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.bg, 0.5),
  },
  cardTitle: {
    fontFamily: fonts.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: colors.text,
  },
  cardContent: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.muted,
  },
  cardUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardUrl: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.cyan,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.7),
  },
  tagText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.dim,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cardDate: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.faint,
  },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  emptyActionText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.bg,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2, 3, 5, 0.62)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheetShell: {
    maxHeight: '92%',
  },
  sheet: {
    maxHeight: '100%',
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderBright,
    alignSelf: 'center',
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sheetEyebrow: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    letterSpacing: 1.4,
    color: colors.primaryLight,
    textTransform: 'uppercase',
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 21,
    letterSpacing: -0.6,
    color: colors.text,
  },
  sheetClose: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.8),
  },
  formScroll: {
    flexGrow: 0,
  },
  formContent: {
    paddingBottom: spacing.sm,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  typePress: {
    flexGrow: 0,
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.55),
  },
  typeOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  typeOptionMuted: {
    opacity: 0.45,
  },
  typeOptionText: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    letterSpacing: 0.4,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  typeOptionTextActive: {
    color: colors.bg,
  },
  fieldGroup: {
    marginBottom: spacing.md,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 5,
  },
  fieldLabel: {
    fontFamily: fonts.monoMedium,
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  required: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.primary,
  },
  fieldInput: {
    minHeight: 42,
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.bg, 0.62),
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
  },
  fieldInputMultiline: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  fieldInputFocused: {
    borderColor: alpha(colors.primary, 0.65),
    backgroundColor: alpha(colors.primary, 0.035),
  },
  fieldInputError: {
    borderColor: alpha(colors.danger, 0.7),
  },
  fieldError: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.dangerLight,
    marginTop: 4,
  },
  fieldHint: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.faint,
    marginTop: 4,
  },
  submitError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: alpha(colors.danger, 0.3),
    backgroundColor: alpha(colors.danger, 0.08),
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  submitErrorText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 10,
    lineHeight: 14,
    color: colors.dangerLight,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cancelPress: {
    flex: 1,
  },
  cancelButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: alpha(colors.elevated, 0.7),
  },
  cancelButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.textSoft,
  },
  savePress: {
    flex: 1.4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  saveButtonText: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    color: colors.bg,
  },
})
