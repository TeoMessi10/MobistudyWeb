<template>
  <div class="q-pa-lg">
    <q-card flat bordered>
      <!-- Header -->
      <q-card-section class="row items-center justify-between q-py-md">
        <div class="text-h6 row items-center no-wrap">
          <q-icon name="sticky_note_2" size="22px" class="text-accent q-mr-sm" />
          Clinical Notes
        </div>
        <q-badge rounded color="grey-3" text-color="grey-8"
          :label="`${notes.length} ${notes.length === 1 ? 'note' : 'notes'}`" />
      </q-card-section>
      <q-separator />

      <!-- Add note -->
      <q-card-section class="bg-grey-1">
        <q-card flat bordered class="note-composer">
          <q-input v-model="newNote" type="textarea" borderless
            placeholder="Add a clinical note..." :disable="saving" class="q-px-sm"
            :input-style="{ height: '110px', resize: 'none', overflowX: 'hidden' }"
            @keydown.ctrl.enter.prevent="addNote" />
          <q-separator />
          <q-card-section class="row items-center q-gutter-x-xs q-py-sm bg-white">
            <span class="text-caption text-grey-7 row items-center no-wrap">
              <q-icon name="sell" size="13px" class="q-mr-xs" />Category:
            </span>
            <q-chip v-for="cat in categories" :key="cat.id" clickable size="sm" class="cat-chip"
              :outline="newNoteCategoryId !== cat.id" text-color="grey-8"
              :style="newNoteCategoryId === cat.id ? { backgroundColor: cat.color, color: '#fff' } : {}"
              @click="newNoteCategoryId = cat.id">
              <span v-if="newNoteCategoryId !== cat.id" class="cat-dot q-mr-xs" :style="{ background: cat.color }" />
              {{ cat.label }}
            </q-chip>
          </q-card-section>
        </q-card>
        <div class="row items-center justify-between q-mt-sm">
          <span class="text-caption text-grey">Ctrl+Enter to add</span>
          <q-btn unelevated no-caps icon="add" label="Add Note" class="bg-accent text-white"
            :disable="!newNote.trim() || saving" :loading="saving" @click="addNote" />
        </div>
      </q-card-section>
      <q-separator />

      <!-- List -->
      <q-card-section>
        <!-- Filters: category chips + author + sort -->
        <div v-if="!loading" class="row items-center justify-between q-col-gutter-md q-mb-md">
          <div class="col row items-center">
            <q-chip clickable size="sm" class="cat-chip"
              :class="filterCategoryId === 'all' ? 'bg-accent text-white' : ''"
              label="All" @click="filterCategoryId = 'all'" />
            <q-chip v-for="cat in categories" :key="cat.id" clickable size="sm" class="cat-chip"
              :class="filterCategoryId === cat.id ? 'bg-accent text-white' : ''"
              :removable="cat.id !== 'general'"
              @click="filterCategoryId = cat.id" @remove="confirmDeleteCategory(cat)">
              <span class="cat-dot q-mr-xs" :style="{ background: cat.color }" />
              {{ cat.label }}
            </q-chip>
            <q-chip v-if="canAddCategory" clickable size="sm" class="cat-chip" outline color="grey-7"
              icon="add" label="New category" @click="openCategoryDialog">
              <q-tooltip>{{ categories.length }}/{{ maxCategories }} categories</q-tooltip>
            </q-chip>
            <q-chip v-else size="sm" class="cat-chip" outline color="grey-5"
              icon="block" :label="`Max ${maxCategories} categories`" />
          </div>
          <div v-if="notes.length" class="col-auto row items-center q-gutter-x-sm">
            <q-select v-model="authorFilter" :options="authorOptions" emit-value map-options
              dense outlined options-dense bg-color="white" class="notes-author-select"
              label="Author" />
            <q-btn flat dense no-caps color="grey-7"
              :icon="sortOrder === 'newest' ? 'south' : 'north'"
              :label="sortOrder === 'newest' ? 'Newest first' : 'Oldest first'"
              @click="toggleSort" />
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading" class="column items-center text-grey q-py-xl">
          <q-spinner color="secondary" size="28px" />
          <span class="q-mt-sm">Loading notes…</span>
        </div>

        <!-- Empty -->
        <div v-else-if="notes.length === 0" class="column items-center text-grey q-py-xl">
          <q-icon name="sticky_note_2" size="36px" color="grey-4" />
          <span class="q-mt-sm">No notes yet</span>
        </div>

        <!-- Empty (filtered) -->
        <div v-else-if="filteredNotes.length === 0" class="column items-center text-grey q-py-xl">
          <q-icon name="filter_alt_off" size="36px" color="grey-4" />
          <span class="q-mt-sm">No notes match the current filters</span>
        </div>

        <!-- Timeline -->
        <div v-else class="notes-timeline">
          <div v-for="note in filteredNotes" :key="note._key" class="note-item">
            <div class="note-dot" :style="{ background: noteDotColor(note) }" />
            <q-card flat bordered class="note-card"
              :class="editingKey !== note._key ? 'cursor-pointer' : ''"
              @click="toggleActions(note)">
              <q-card-section class="q-pa-md">
                <div class="row items-start justify-between q-mb-sm">
                  <div class="row items-center q-gutter-x-xs text-caption text-grey">
                    <q-badge v-if="noteCategory(note)" rounded class="text-capitalize"
                      :style="{ background: noteCategory(note).color }" :label="noteCategory(note).label" />
                    <q-icon name="event" size="13px" />
                    {{ niceTimestamp(note.createdTS) }}
                    <span v-if="isEdited(note)" class="text-italic">(edited)</span>
                  </div>
                  <div class="row items-center q-gutter-x-xs text-caption text-grey-7 no-wrap">
                    <q-icon name="person" size="14px" />{{ note.authorEmail }}
                  </div>
                </div>

                <!-- Inline edit -->
                <template v-if="editingKey === note._key">
                  <q-input v-model="editText" type="textarea" outlined bg-color="white"
                    class="notes-textarea" :disable="savingEdit"
                    :input-style="{ height: '100px', resize: 'none', overflowX: 'hidden' }"
                    @click.stop
                    @keydown.ctrl.enter.prevent="saveEdit(note)" />
                  <div class="row justify-end q-gutter-x-sm q-mt-sm" @click.stop>
                    <q-btn flat no-caps dense label="Cancel" color="grey-7"
                      :disable="savingEdit" @click="cancelEdit" />
                    <q-btn unelevated no-caps dense label="Save" class="bg-accent text-white"
                      :disable="!editText.trim() || savingEdit" :loading="savingEdit"
                      @click="saveEdit(note)" />
                  </div>
                </template>

                <template v-else>
                  <p class="note-text">{{ note.text }}</p>
                  <!-- Actions, revealed by clicking a note -->
                  <div v-if="activeKey === note._key" @click.stop>
                    <q-separator class="q-my-sm" />
                    <div class="row items-center q-gutter-x-xs">
                      <span class="text-caption text-grey-7 row items-center no-wrap">
                        <q-icon name="sell" size="12px" class="q-mr-xs" />Category:
                      </span>
                      <q-chip v-for="cat in categories" :key="cat.id" clickable size="sm" class="cat-chip"
                        :outline="noteCategoryId(note) !== cat.id" text-color="grey-8"
                        :style="noteCategoryId(note) === cat.id ? { backgroundColor: cat.color, color: '#fff' } : {}"
                        @click="setNoteCategory(note, cat.id)">
                        <span v-if="noteCategoryId(note) !== cat.id" class="cat-dot q-mr-xs"
                          :style="{ background: cat.color }" />
                        {{ cat.label }}
                      </q-chip>
                      <q-chip v-if="noteCategoryId(note)" clickable size="sm" class="cat-chip" outline
                        color="grey-6" label="Clear" @click="setNoteCategory(note, null)" />
                    </div>
                    <div v-if="isOwn(note)" class="row q-gutter-x-sm q-mt-sm">
                      <q-btn flat dense no-caps size="sm" label="Edit" class="text-accent"
                        @click="startEdit(note)" />
                      <q-btn flat dense no-caps size="sm" label="Delete" color="negative"
                        @click="confirmDelete(note)" />
                    </div>
                  </div>
                </template>
              </q-card-section>
            </q-card>
          </div>
        </div>
      </q-card-section>
    </q-card>

    <!-- Create category dialog -->
    <q-dialog v-model="showCategoryDialog">
      <q-card style="width: 360px; max-width: 90vw">
        <q-card-section class="text-h6">New category</q-card-section>
        <q-card-section class="q-pt-none">
          <q-input v-model="newCategoryName" outlined dense autofocus label="Category name"
            :error="!!categoryError" :error-message="categoryError"
            @keyup.enter="addCategory" />
          <div class="row q-gutter-sm q-mt-md">
            <q-btn v-for="color in categoryPalette" :key="color" round unelevated size="13px"
              :style="{ backgroundColor: color }" :disable="isColorTaken(color)"
              :title="isColorTaken(color) ? 'Already used by another category' : ''"
              @click="newCategoryColor = color">
              <q-icon v-if="newCategoryColor === color" name="check" color="white" size="16px" />
              <q-icon v-else-if="isColorTaken(color)" name="close" color="white" size="14px" />
            </q-btn>
          </div>
          <p class="text-caption text-grey q-mt-sm q-mb-none">
            Greyed-out colours are already used by another category.
          </p>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat no-caps label="Cancel" color="grey-7" v-close-popup />
          <q-btn unelevated no-caps label="Create" class="bg-accent text-white"
            :disable="!newCategoryName.trim()" @click="addCategory" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script>
import API from '@shared/API.js'
import userinfo from '@shared/userinfo.js'
import { date } from 'quasar'

// Maximum number of categories (including the defaults) a researcher can have
const MAX_CATEGORIES = 9

// Default categories mirror the Figma prototype. Researchers can add their own.
const DEFAULT_CATEGORIES = [
  { id: 'general', label: 'General', color: '#9ca3af' },
  { id: 'observation', label: 'Observation', color: '#3b82f6' },
  { id: 'incident', label: 'Incident', color: '#ef4444' },
  { id: 'medication', label: 'Medication', color: '#a855f7' }
]

// Colour choices offered when creating a custom category
const CATEGORY_PALETTE = [
  '#9ca3af', '#6b7280', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6',
  '#10b981', '#16a34a', '#84cc16', '#eab308', '#f59e0b', '#f97316',
  '#ef4444', '#dc2626', '#ec4899', '#d946ef', '#a855f7', '#6366f1'
]

export default {
  name: 'NotesTab',
  props: ['studyKey', 'userKey'],
  data () {
    return {
      notes: [],
      newNote: '',
      loading: false,
      saving: false,
      // key of the note whose actions/category picker are revealed
      activeKey: null,
      // inline edit state
      editingKey: null,
      editText: '',
      savingEdit: false,
      // categories (frontend-only, saved in localStorage)
      categories: [],
      noteCategoryMap: {},
      filterCategoryId: 'all',
      authorFilter: 'all',
      sortOrder: 'newest',
      newNoteCategoryId: null,
      categoryPalette: CATEGORY_PALETTE,
      maxCategories: MAX_CATEGORIES,
      // create-category dialog
      showCategoryDialog: false,
      newCategoryName: '',
      newCategoryColor: CATEGORY_PALETTE[0],
      categoryError: ''
    }
  },
  computed: {
    // The logged-in user's _key, used to decide note ownership. The backend
    // derives a note's authorUserKey from the decoded JWT, so we read the same
    // _key out of the token (falling back to the stored userinfo value).
    myUserKey () {
      const fromToken = this._userKeyFromToken()
      if (fromToken != null) return String(fromToken)
      const stored = userinfo.user && userinfo.user._key
      return stored != null ? String(stored) : null
    },
    filteredNotes () {
      let list = this.notes
      if (this.filterCategoryId !== 'all') {
        list = list.filter(n => this.noteCategoryId(n) === this.filterCategoryId)
      }
      if (this.authorFilter !== 'all') {
        list = list.filter(n => String(n.authorUserKey) === String(this.authorFilter))
      }
      const dir = this.sortOrder === 'oldest' ? 1 : -1
      return [...list].sort((a, b) => dir * (new Date(a.createdTS) - new Date(b.createdTS)))
    },
    // Distinct authors present in the loaded notes, for the author filter
    authorOptions () {
      const seen = new Map()
      for (const n of this.notes) {
        if (!seen.has(n.authorUserKey)) seen.set(n.authorUserKey, n.authorEmail)
      }
      const opts = Array.from(seen, ([key, email]) => ({ label: email, value: key }))
      opts.sort((a, b) => (a.label || '').localeCompare(b.label || ''))
      return [{ label: 'All authors', value: 'all' }, ...opts]
    },
    // Colours already taken by an existing category (lowercased for comparison)
    usedColors () {
      return new Set(this.categories.map(c => (c.color || '').toLowerCase()))
    },
    canAddCategory () {
      return this.categories.length < MAX_CATEGORIES
    }
  },
  created () {
    this.loadCategories()
    this.loadCategoryMap()
    this.loadNotes()
  },
  methods: {
    niceTimestamp (ts) {
      return date.formatDate(ts, 'MMM D, YYYY · HH:mm')
    },
    isEdited (note) {
      return note.updatedTS && note.createdTS && new Date(note.updatedTS) > new Date(note.createdTS)
    },
    // Edit/delete are only allowed for the author (compared to the logged-in user's _key)
    isOwn (note) {
      return this.myUserKey != null && String(note.authorUserKey) === this.myUserKey
    },
    _userKeyFromToken () {
      const token = userinfo.user && userinfo.user.token
      if (!token || token.split('.').length < 2) return null
      try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
        const payload = JSON.parse(decodeURIComponent(escape(window.atob(base64))))
        return payload._key != null ? payload._key : (payload.userKey != null ? payload.userKey : null)
      } catch (err) {
        return null
      }
    },
    async loadNotes () {
      this.loading = true
      try {
        const data = await API.getNotes(this.studyKey, this.userKey)
        // Endpoint returns either an array or { totalCount, subset } when paginated
        this.notes = Array.isArray(data) ? data : (data?.subset || [])
      } catch (err) {
        console.error(err)
        this.$q.notify({
          color: 'negative',
          icon: 'report_problem',
          message: err?.response?.status === 403
            ? 'You do not have access to notes for this study'
            : 'Could not load notes'
        })
      } finally {
        this.loading = false
      }
    },
    async addNote () {
      const text = this.newNote.trim()
      if (!text || this.saving) return
      this.saving = true
      try {
        const created = await API.createNote(this.studyKey, this.userKey, text)
        if (created && created._key) {
          this.notes.unshift(created)
          // Persist the chosen category locally for the new note
          if (this.newNoteCategoryId) this.setNoteCategory(created, this.newNoteCategoryId)
        } else {
          await this.loadNotes()
        }
        this.newNote = ''
      } catch (err) {
        console.error(err)
        this.$q.notify({
          color: 'negative',
          icon: 'report_problem',
          message: err?.response?.status === 403
            ? 'You do not have permission to create notes in this study'
            : 'Could not save the note'
        })
      } finally {
        this.saving = false
      }
    },
    toggleSort () {
      this.sortOrder = this.sortOrder === 'newest' ? 'oldest' : 'newest'
    },
    // Clicking a note toggles its expanded area (category picker + own-note actions)
    toggleActions (note) {
      if (this.editingKey === note._key) return
      this.activeKey = this.activeKey === note._key ? null : note._key
    },
    startEdit (note) {
      this.editingKey = note._key
      this.editText = note.text
      this.activeKey = null
    },
    cancelEdit () {
      this.editingKey = null
      this.editText = ''
    },
    async saveEdit (note) {
      const text = this.editText.trim()
      if (!text || this.savingEdit) return
      this.savingEdit = true
      try {
        const updated = await API.updateNote(note._key, text)
        const idx = this.notes.findIndex(n => n._key === note._key)
        if (idx !== -1) {
          // Use server response when available, otherwise patch locally
          this.notes.splice(idx, 1, updated && updated._key ? updated : { ...note, text, updatedTS: new Date().toISOString() })
        }
        this.cancelEdit()
      } catch (err) {
        console.error(err)
        this.$q.notify({
          color: 'negative',
          icon: 'report_problem',
          message: this._noteErrorMessage(err, {
            403: 'You can only edit your own notes',
            404: 'The note no longer exists',
            fallback: 'Could not update the note'
          })
        })
        if (err?.response?.status === 404) {
          this.notes = this.notes.filter(n => n._key !== note._key)
          this.cancelEdit()
        }
      } finally {
        this.savingEdit = false
      }
    },
    confirmDelete (note) {
      this.$q.dialog({
        title: 'Delete note',
        message: 'Are you sure you want to delete this note? This cannot be undone.',
        cancel: { label: 'Cancel', flat: true, color: 'grey-7' },
        ok: { label: 'Delete', color: 'negative', unelevated: true },
        persistent: true
      }).onOk(() => this.deleteNote(note))
    },
    async deleteNote (note) {
      try {
        await API.deleteNote(note._key)
        this.notes = this.notes.filter(n => n._key !== note._key)
        if (this.editingKey === note._key) this.cancelEdit()
      } catch (err) {
        console.error(err)
        if (err?.response?.status === 404) {
          // Already gone on the server — drop it from the list anyway
          this.notes = this.notes.filter(n => n._key !== note._key)
        }
        this.$q.notify({
          color: 'negative',
          icon: 'report_problem',
          message: this._noteErrorMessage(err, {
            403: 'You can only delete your own notes',
            404: 'The note no longer exists',
            fallback: 'Could not delete the note'
          })
        })
      }
    },
    _noteErrorMessage (err, messages) {
      const status = err?.response?.status
      return messages[status] || messages.fallback
    },

    // ── Categories (frontend-only, localStorage) ──────────────────────
    _categoriesStorageKey () {
      return `notes-categories-v1-${this.studyKey}`
    },
    _categoryMapStorageKey () {
      return `notes-category-map-v1-${this.studyKey}`
    },
    loadCategories () {
      try {
        const raw = localStorage.getItem(this._categoriesStorageKey())
        const parsed = raw ? JSON.parse(raw) : null
        this.categories = Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_CATEGORIES.slice()
      } catch {
        this.categories = DEFAULT_CATEGORIES.slice()
      }
      if (!this.newNoteCategoryId && this.categories.length) {
        this.newNoteCategoryId = this.categories[0].id
      }
    },
    saveCategories () {
      try {
        localStorage.setItem(this._categoriesStorageKey(), JSON.stringify(this.categories))
      } catch {}
    },
    loadCategoryMap () {
      try {
        const raw = localStorage.getItem(this._categoryMapStorageKey())
        const parsed = raw ? JSON.parse(raw) : null
        this.noteCategoryMap = parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        this.noteCategoryMap = {}
      }
    },
    saveCategoryMap () {
      try {
        localStorage.setItem(this._categoryMapStorageKey(), JSON.stringify(this.noteCategoryMap))
      } catch {}
    },
    categoryById (id) {
      return this.categories.find(c => c.id === id) || null
    },
    noteCategoryId (note) {
      return this.noteCategoryMap[note._key] || null
    },
    noteCategory (note) {
      return this.categoryById(this.noteCategoryId(note))
    },
    noteDotColor (note) {
      const cat = this.noteCategory(note)
      return cat ? cat.color : '#5F8D98'
    },
    setNoteCategory (note, catId) {
      const map = { ...this.noteCategoryMap }
      if (catId) map[note._key] = catId
      else delete map[note._key]
      this.noteCategoryMap = map
      this.saveCategoryMap()
    },
    isColorTaken (color) {
      return this.usedColors.has((color || '').toLowerCase())
    },
    openCategoryDialog () {
      if (!this.canAddCategory) return
      this.newCategoryName = ''
      // Pre-select the first colour that isn't already used by a category
      this.newCategoryColor = CATEGORY_PALETTE.find(c => !this.isColorTaken(c)) || CATEGORY_PALETTE[0]
      this.categoryError = ''
      this.showCategoryDialog = true
    },
    addCategory () {
      const label = this.newCategoryName.trim()
      if (!label) return
      if (!this.canAddCategory) {
        this.categoryError = `You can have at most ${MAX_CATEGORIES} categories`
        return
      }
      const exists = this.categories.some(c => c.label.toLowerCase() === label.toLowerCase())
      if (exists) {
        this.categoryError = 'A category with this name already exists'
        return
      }
      if (this.isColorTaken(this.newCategoryColor)) {
        this.categoryError = 'That colour is already used — pick another one'
        return
      }
      const id = 'cat-' + Date.now().toString(36)
      this.categories.push({ id, label, color: this.newCategoryColor })
      this.saveCategories()
      // Pre-select the new category for the next note
      this.newNoteCategoryId = id
      this.showCategoryDialog = false
    },
    confirmDeleteCategory (cat) {
      // "General" is the built-in default and cannot be removed
      if (cat.id === 'general') return
      const count = this.notes.filter(n => this.noteCategoryId(n) === cat.id).length
      const suffix = count > 0
        ? ` ${count} ${count === 1 ? 'note' : 'notes'} will become uncategorized.`
        : ''
      this.$q.dialog({
        title: 'Delete category',
        message: `Delete the category "${cat.label}"?${suffix}`,
        cancel: { label: 'Cancel', flat: true, color: 'grey-7' },
        ok: { label: 'Delete', color: 'negative', unelevated: true },
        persistent: true
      }).onOk(() => this.deleteCategory(cat))
    },
    deleteCategory (cat) {
      // Remove the category itself
      this.categories = this.categories.filter(c => c.id !== cat.id)
      this.saveCategories()
      // Drop any note mappings that pointed to it
      const map = { ...this.noteCategoryMap }
      let changed = false
      for (const key of Object.keys(map)) {
        if (map[key] === cat.id) {
          delete map[key]
          changed = true
        }
      }
      if (changed) {
        this.noteCategoryMap = map
        this.saveCategoryMap()
      }
      // Reset selections that referenced the removed category
      if (this.filterCategoryId === cat.id) this.filterCategoryId = 'all'
      if (this.newNoteCategoryId === cat.id) {
        this.newNoteCategoryId = this.categories.length ? this.categories[0].id : null
      }
    }
  }
}
</script>

<style scoped>
/* Figma brand accent (not part of the Quasar palette) */
.text-accent { color: #5F8D98 !important; }
.bg-accent { background: #5F8D98 !important; }

/* Composer focus ring */
.note-composer { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
.note-composer:focus-within { border-color: #5F8D98; box-shadow: 0 0 0 2px rgba(95, 141, 152, 0.2); }

/* Inline-edit textarea */
.notes-textarea :deep(.q-field__control::before),
.notes-textarea :deep(.q-field__control::after) { border: none; }
.notes-textarea :deep(textarea) { overflow-x: hidden; overflow-y: auto; }

.notes-author-select { min-width: 150px; max-width: 220px; }

/* Category chips: airier padding + vertically-centered colour dot */
.cat-chip :deep(.q-chip__content) { padding: 2px 6px; }
.cat-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; align-self: center; }

/* Timeline rail + dot (no Quasar equivalent) */
.notes-timeline { position: relative; padding-left: 20px; border-left: 2px solid #e5e7eb; display: flex; flex-direction: column; gap: 20px; }
.note-item { position: relative; }
.note-dot { position: absolute; left: -25px; top: 10px; width: 14px; height: 14px; border-radius: 9999px; background: #5F8D98; border: 2px solid #ffffff; }

.note-card { transition: box-shadow 0.2s ease; }
.note-card:hover { box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08); }

.note-text { margin: 0; font-size: 0.875rem; line-height: 1.5; color: #374151; white-space: pre-wrap; word-break: break-word; }
</style>
