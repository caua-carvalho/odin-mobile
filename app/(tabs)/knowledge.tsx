import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, FlatList, Alert, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { cn, formatRelativeTime } from '../../lib/utils'
import { api, type KnowledgeItem } from '../../lib/api'

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#181818' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#ff6b00' },
  fab: { position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#ff6b00', justifyContent: 'center', alignItems: 'center', elevation: 4 },
  searchContainer: { padding: 16 },
  searchInput: { backgroundColor: '#181818', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#282828' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  filterBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 8, backgroundColor: '#181818', borderWidth: 1, borderColor: '#282828' },
  filterBtnActive: { backgroundColor: '#ff6b00', borderColor: '#ff6b00' },
  filterBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  filterBtnTextActive: { color: '#0a0a0a' },
  listContainer: { paddingHorizontal: 16, paddingBottom: 100 },
  itemCard: { backgroundColor: '#101010', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#282828' },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  itemTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#ff6b0020', borderWidth: 1, borderColor: '#ff6b0040' },
  itemTypeText: { color: '#ff6b00', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  itemActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 8 },
  itemTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  itemContent: { color: '#a8a8a8', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  itemUrl: { flexDirection: 'row', alignItems: 'center', gap: 6, color: '#ff6b00', fontSize: 13, marginBottom: 12 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#282828', borderWidth: 1, borderColor: '#383838' },
  tagText: { color: '#a8a8a8', fontSize: 11 },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#181818' },
  itemDate: { color: '#505050', fontSize: 11 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  emptyIcon: { marginBottom: 16 },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { color: '#686868', fontSize: 14, textAlign: 'center' },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,10,10,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%', padding: 20 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#282828', alignSelf: 'center', marginBottom: 16 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 20 },
  formGroup: { marginBottom: 16 },
  label: { color: '#a8a8a8', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: '#181818', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#282828' },
  inputError: { borderColor: '#e05600' },
  errorText: { color: '#e05600', fontSize: 12, marginTop: 6 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#181818' },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#181818', alignItems: 'center', borderWidth: 1, borderColor: '#282828' },
  cancelBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  saveBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, backgroundColor: '#ff6b00', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  typeSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeOption: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8, backgroundColor: '#181818', borderWidth: 1, borderColor: '#282828' },
  typeOptionActive: { backgroundColor: '#ff6b00', borderColor: '#ff6b00' },
  typeOptionText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  typeOptionTextActive: { color: '#0a0a0a' },
})

const KNOWLEDGE_TYPES = [
  { value: 'note', label: 'Nota', icon: 'document-text' },
  { value: 'link', label: 'Link', icon: 'link' },
  { value: 'snippet', label: 'Trecho', icon: 'code' },
  { value: 'personal', label: 'Pessoal', icon: 'person' },
] as const

export default function KnowledgeScreen() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<KnowledgeItem | null>(null)
  const [formData, setFormData] = useState({
    type: 'note',
    title: '',
    content: '',
    url: '',
    tags: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadItems()
  }, [search, typeFilter])

  const loadItems = async () => {
    try {
      const data = await api.listKnowledge({
        page_size: 50,
        q: search || undefined,
        type: typeFilter || undefined,
      })
      setItems(data.items)
    } catch (err: any) {
      Alert.alert('Erro', err.response?.data?.detail || 'Erro ao carregar itens')
    } finally {
      setLoading(false)
    }
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (item: KnowledgeItem) => {
    setEditingItem(item)
    setFormData({
      type: item.type,
      title: item.title,
      content: item.content,
      url: item.url || '',
      tags: item.tags.join(', '),
    })
    setShowModal(true)
  }

  const resetForm = () => {
    setFormData({ type: 'note', title: '', content: '', url: '', tags: '' })
    setFormErrors({})
    setEditingItem(null)
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    if (!formData.title.trim()) errors.title = 'Título é obrigatório'
    if (!formData.content.trim()) errors.content = 'Conteúdo é obrigatório'
    if (formData.type === 'link' && formData.url.trim() && !isValidUrl(formData.url.trim())) {
      errors.url = 'URL inválida'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const data = {
        type: formData.type,
        title: formData.title.trim(),
        content: formData.content.trim(),
        url: formData.type === 'link' && formData.url.trim() ? formData.url.trim() : undefined,
        tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
      }

      if (editingItem) {
        await api.updateKnowledge(editingItem.id, data)
      } else {
        await api.createKnowledge(data)
      }

      resetForm()
      setShowModal(false)
      loadItems()
    } catch (err: any) {
      setFormErrors({ submit: err.response?.data?.detail || 'Erro ao salvar' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    Alert.alert('Confirmar', 'Excluir este item?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: async () => {
        try {
          await api.deleteKnowledge(id)
          loadItems()
        } catch (err: any) {
          Alert.alert('Erro', err.response?.data?.detail || 'Erro ao excluir')
        }
      }},
    ])
  }

  if (loading && items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#ff6b00" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Biblioteca</Text>
        <TouchableOpacity onPress={openCreateModal} style={styles.fab}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por título ou conteúdo..."
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#686868"
        />
      </View>

      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <TouchableOpacity
          onPress={() => setTypeFilter('')}
          style={[styles.filterBtn, !typeFilter && styles.filterBtnActive]}
        >
          <Ionicons name="apps" size={16} color={!typeFilter ? '#0a0a0a' : '#fff'} />
          <Text style={[styles.filterBtnText, !typeFilter && styles.filterBtnTextActive]}>Todos</Text>
        </TouchableOpacity>
        {KNOWLEDGE_TYPES.map(t => (
          <TouchableOpacity
            key={t.value}
            onPress={() => setTypeFilter(typeFilter === t.value ? '' : t.value)}
            style={[styles.filterBtn, typeFilter === t.value && styles.filterBtnActive]}
          >
            <Ionicons name={t.icon} size={16} color={typeFilter === t.value ? '#0a0a0a' : '#fff'} />
            <Text style={[styles.filterBtnText, typeFilter === t.value && styles.filterBtnTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onLongPress={() => {
              Alert.alert('Opções', '', [
                { text: 'Editar', onPress: () => openEditModal(item) },
                { text: 'Excluir', style: 'destructive', onPress: () => handleDelete(item.id) },
                { text: 'Cancelar', style: 'cancel' },
              ])
            }}
            style={styles.itemCard}
          >
            <View style={styles.itemHeader}>
              <View style={styles.itemTypeBadge}>
                <Ionicons name={KNOWLEDGE_TYPES.find(t => t.value === item.type)?.icon || 'document'} size={14} color="#ff6b00" />
                <Text style={styles.itemTypeText}>{KNOWLEDGE_TYPES.find(t => t.value === item.type)?.label}</Text>
              </View>
              <View style={styles.itemActions}>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
                  <Ionicons name="create-outline" size={20} color="#686868" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.actionBtn}>
                  <Ionicons name="trash-outline" size={20} color="#686868" />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>

            <Text style={styles.itemContent} numberOfLines={3}>{item.content}</Text>

            {item.url && (
              <Text style={styles.itemUrl}>
                <Ionicons name="link" size={14} />
                {item.url.length > 40 ? item.url.slice(0, 40) + '...' : item.url}
              </Text>
            )}

            {item.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                {item.tags.slice(0, 5).map(tag => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
                {item.tags.length > 5 && (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>+{item.tags.length - 5}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.itemFooter}>
              <Text style={styles.itemDate}>{formatRelativeTime(item.updated_at || item.created_at)}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="library-outline" size={64} color="#282828" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>Nenhum item</Text>
            <Text style={styles.emptySubtitle}>
              {search || typeFilter ? 'Tente ajustar os filtros' : 'Crie sua primeira nota tocando no +'}
            </Text>
          </View>
        }
        contentContainerStyle={styles.listContainer}
      />

      <Modal visible={showModal} animationType="slide" transparent={true} onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity onPress={() => setShowModal(false)} style={styles.modalOverlay} activeOpacity={1}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{editingItem ? 'Editar item' : 'Novo item'}</Text>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tipo</Text>
              <View style={styles.typeSelector}>
                {KNOWLEDGE_TYPES.map(t => (
                  <TouchableOpacity
                    key={t.value}
                    onPress={() => setFormData(prev => ({ ...prev, type: t.value }))}
                    style={[styles.typeOption, formData.type === t.value && styles.typeOptionActive]}
                    disabled={!!editingItem}
                  >
                    <Ionicons name={t.icon} size={16} color={formData.type === t.value ? '#0a0a0a' : '#fff'} />
                    <Text style={[styles.typeOptionText, formData.type === t.value && styles.typeOptionTextActive]}>{t.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Título <Text style={{ color: '#e05600' }}>*</Text></Text>
              <TextInput
                style={[styles.input, formErrors.title ? styles.inputError : null]}
                value={formData.title}
                onChangeText={text => setFormData(prev => ({ ...prev, title: text }))}
                placeholder="Título do item"
                editable={!editingItem}
              />
              {formErrors.title && <Text style={styles.errorText}>{formErrors.title}</Text>}
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Conteúdo <Text style={{ color: '#e05600' }}>*</Text></Text>
              <TextInput
                style={[styles.input, formErrors.content ? styles.inputError : null]}
                value={formData.content}
                onChangeText={text => setFormData(prev => ({ ...prev, content: text }))}
                placeholder="Conteúdo do item"
                multiline
                numberOfLines={5}
              />
              {formErrors.content && <Text style={styles.errorText}>{formErrors.content}</Text>}
            </View>

            {formData.type === 'link' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>URL</Text>
                <TextInput
                  style={[styles.input, formErrors.url ? styles.inputError : null]}
                  value={formData.url}
                  onChangeText={text => setFormData(prev => ({ ...prev, url: text }))}
                  placeholder="https://exemplo.com"
                  keyboardType="url"
                />
                {formErrors.url && <Text style={styles.errorText}>{formErrors.url}</Text>}
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>Tags (separadas por vírgula)</Text>
              <TextInput
                style={styles.input}
                value={formData.tags}
                onChangeText={text => setFormData(prev => ({ ...prev, tags: text }))}
                placeholder="trabalho, importante, ideia"
              />
            </View>

            {formErrors.submit && <Text style={styles.errorText}>{formErrors.submit}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSubmit} style={styles.saveBtn} disabled={submitting}>
                <Text style={styles.saveBtnText}>{submitting ? 'Salvando...' : (editingItem ? 'Atualizar' : 'Criar')}</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  )
}

function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}