<template>
  <div class="q-pa-lg">
    <div class="notes-card">
      <!-- Header -->
      <div class="notes-header">
        <div class="notes-title">
          <q-icon name="sticky_note_2" size="20px" class="notes-title-icon" />
          <span>Clinical Notes</span>
        </div>
        <span class="notes-count">{{ notes.length }} {{ notes.length === 1 ? 'note' : 'notes' }}</span>
      </div>

      <!-- Add note -->
      <div class="notes-add">
        <q-input v-model="newNote" type="textarea" outlined bg-color="white"
          placeholder="Add a clinical note..." :disable="saving" class="notes-textarea"
          :input-style="{ height: '120px', resize: 'none', overflowX: 'hidden' }"
          @keydown.ctrl.enter.prevent="addNote" />
        <div class="notes-add-actions">
          <span class="notes-hint">Ctrl+Enter to add</span>
          <q-btn unelevated no-caps icon="add" label="Add Note" class="notes-add-btn"
            :disable="!newNote.trim() || saving" :loading="saving" @click="addNote" />
        </div>
      </div>

      <!-- List -->
      <div class="notes-list">
        <!-- Loading -->
        <div v-if="loading" class="notes-state">
          <q-spinner color="secondary" size="28px" />
          <span class="q-mt-sm">Loading notes…</span>
        </div>

        <!-- Empty -->
        <div v-else-if="notes.length === 0" class="notes-state">
          <q-icon name="sticky_note_2" size="36px" color="grey-4" />
          <span class="q-mt-sm">No notes yet</span>
        </div>

        <!-- Timeline -->
        <div v-else class="notes-timeline">
          <div v-for="note in notes" :key="note._key" class="note-item">
            <div class="note-dot" />
            <div class="note-card" :class="{ 'note-card--clickable': isOwn(note) && editingKey !== note._key }"
              @click="toggleActions(note)">
              <div class="note-card-head">
                <span class="note-author">
                  <q-icon name="person" size="14px" />
                  {{ note.authorEmail }}
                </span>
                <span class="note-date">
                  <q-icon name="event" size="13px" />
                  {{ niceTimestamp(note.createdTS) }}
                  <span v-if="isEdited(note)" class="note-edited">(edited)</span>
                </span>
              </div>

              <!-- Inline edit -->
              <template v-if="editingKey === note._key">
                <q-input v-model="editText" type="textarea" outlined bg-color="white"
                  class="notes-textarea" :disable="savingEdit"
                  :input-style="{ height: '100px', resize: 'none', overflowX: 'hidden' }"
                  @click.stop
                  @keydown.ctrl.enter.prevent="saveEdit(note)" />
                <div class="note-edit-actions" @click.stop>
                  <q-btn flat no-caps dense label="Cancel" color="grey-7"
                    :disable="savingEdit" @click="cancelEdit" />
                  <q-btn unelevated no-caps dense label="Save" class="notes-add-btn"
                    :disable="!editText.trim() || savingEdit" :loading="savingEdit"
                    @click="saveEdit(note)" />
                </div>
              </template>

              <template v-else>
                <p class="note-text">{{ note.text }}</p>
                <!-- Text actions, revealed by clicking an own note -->
                <div v-if="isOwn(note) && activeKey === note._key" class="note-text-actions" @click.stop>
                  <span class="note-text-action" @click="startEdit(note)">Edit</span>
                  <span class="note-text-action note-text-action--danger" @click="confirmDelete(note)">Delete</span>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import API from '@shared/API.js'
import userinfo from '@shared/userinfo.js'
import { date } from 'quasar'

export default {
  name: 'NotesTab',
  props: ['studyKey', 'userKey'],
  data () {
    return {
      notes: [],
      newNote: '',
      loading: false,
      saving: false,
      // key of the note whose text actions (Edit/Delete) are revealed
      activeKey: null,
      // inline edit state
      editingKey: null,
      editText: '',
      savingEdit: false
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
    }
  },
  created () {
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
    // Clicking an own note toggles its Edit/Delete text actions
    toggleActions (note) {
      if (!this.isOwn(note) || this.editingKey === note._key) return
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
    }
  }
}
</script>

<style scoped>
.notes-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

/* Header */
.notes-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #f3f4f6;
}

.notes-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.25rem;
  color: #1f2937;
}

.notes-title-icon {
  color: #5F8D98;
}

.notes-count {
  font-size: 0.72rem;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2px 10px;
  border-radius: 9999px;
}

/* Add note */
.notes-add {
  padding: 16px;
  border-bottom: 1px solid #f3f4f6;
  background: rgba(249, 250, 251, 0.5);
}

.notes-textarea :deep(.q-field__control) {
  border-radius: 6px;
}

.notes-textarea :deep(.q-field__control::before),
.notes-textarea :deep(.q-field__control::after) {
  border: none;
}

.notes-textarea :deep(textarea) {
  line-height: 1.5;
  overflow-x: hidden;
  overflow-y: auto;
}

.notes-add-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.notes-hint {
  font-size: 0.72rem;
  color: #9ca3af;
}

.notes-add-btn {
  background: #5F8D98;
  color: #ffffff;
}

/* List */
.notes-list {
  padding: 16px;
}

.notes-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #9ca3af;
  font-size: 0.875rem;
}

/* Timeline */
.notes-timeline {
  position: relative;
  padding-left: 20px;
  border-left: 2px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.note-item {
  position: relative;
}

.note-dot {
  position: absolute;
  left: -25px;
  top: 6px;
  width: 14px;
  height: 14px;
  border-radius: 9999px;
  background: #5F8D98;
  border: 2px solid #ffffff;
}

.note-card {
  background: #ffffff;
  border: 1px solid #f3f4f6;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  padding: 12px;
  transition: box-shadow 0.2s ease;
}

.note-card:hover {
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
}

.note-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.note-author {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78rem;
  color: #4b5563;
}

.note-date {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: #9ca3af;
}

.note-card--clickable {
  cursor: pointer;
}

.note-text-actions {
  display: flex;
  gap: 16px;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.note-text-action {
  font-size: 0.78rem;
  color: #5F8D98;
  cursor: pointer;
  user-select: none;
}

.note-text-action:hover {
  text-decoration: underline;
}

.note-text-action--danger {
  color: #dc2626;
}

.note-edit-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

.note-edited {
  font-style: italic;
}

.note-text {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.5;
  color: #374151;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
