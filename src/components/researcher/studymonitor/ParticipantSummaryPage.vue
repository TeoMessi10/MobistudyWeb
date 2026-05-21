<template>
  <q-page>
    <q-toolbar class="bg-secondary text-white patient-toolbar">
      <q-toolbar-title>
        <div class="row items-center no-wrap q-gutter-x-lg">
          <span class="patient-name">{{ participant.name }} {{ participant.surname }}</span>
          <span v-if="participant._key" class="patient-id">· #P-{{ participant._key }}</span>

          <patient-trends v-if="studyDescription.tasks" :study-key="studyKey" :user-key="userKey"
            :study-description="studyDescription" :participant="participant" @trends-loaded="onTrendsLoaded" />
        </div>
        <div v-if="participant.dateOfBirth || participant.sex || participant.weight || participant.height"
          class="patient-meta">
          <span v-if="participant.dateOfBirth">{{ new Date(participant.dateOfBirth).toLocaleDateString('sv-SE')
            }}</span>
          <span v-if="participant.dateOfBirth && participant.sex"> · </span>
          <span v-if="participant.sex">{{ participant.sex }}</span>
          <template v-if="participant.weight || participant.height">
            <span v-if="participant.dateOfBirth || participant.sex"> · </span>
            <span v-if="participant.weight">{{ participant.weight }} kg</span>
            <span v-if="participant.weight && participant.height"> · </span>
            <span v-if="participant.height">{{ participant.height }} cm</span>
          </template>
        </div>
        <div v-if="participant.diseases?.length || participant.medications?.length" class="patient-conditions">
          <span v-for="d in participant.diseases" :key="d.conceptId" class="condition-chip condition-chip--disease">
            <q-icon name="medical_information" size="11px" />
            {{ d.term }}
          </span>
          <span v-for="m in participant.medications" :key="m.conceptId" class="condition-chip condition-chip--med">
            <q-icon name="medication" size="11px" />
            {{ m.term }}
          </span>
        </div>
      </q-toolbar-title>
      <q-btn round color="black" icon="close" @click="closeTab()" />
    </q-toolbar>

    <!-- Tab navigation bar -->
    <div class="tab-nav-bar">
      <q-tabs v-model="activeTab" align="left" active-color="secondary" indicator-color="secondary" no-caps
        class="tab-nav-tabs q-px-lg" style="min-height: 56px">
        <q-tab name="progression" icon="ssid_chart" label="Progression" />
        <q-tab name="activity" icon="list_alt" label="Activity Log" />
        <q-tab name="notes" icon="sticky_note_2" label="Notes" />
      </q-tabs>
    </div>

    <!-- Tab content -->
    <!-- keep-alive preserves panel state (e.g. progression chart, selected task) when switching tabs -->
    <q-tab-panels v-model="activeTab" animated keep-alive class="tab-panels-bg">

      <!-- Progression -->
      <q-tab-panel name="progression" class="q-pa-none">

        <!-- Stats overview cards (customizable, 4 slots) -->
        <div v-if="selectedStatKeys.length" class="q-pa-lg">
          <div class="row q-col-gutter-md items-stretch">
            <div v-for="(card, idx) in statCardDefs" :key="card.key" class="col-3">
              <q-card flat bordered class="stat-card fit" :class="card.isAlert ? 'stat-card--alert' : ''">
                <q-card-section class="q-pa-md">
                  <div class="row justify-between items-start q-mb-sm">
                    <div class="stat-icon-wrap"
                      :class="card.isAlert ? 'stat-icon-wrap--alert' : 'stat-icon-wrap--default'">
                      <q-icon :name="card.icon" size="18px" :color="card.isAlert ? 'negative' : 'secondary'" />
                    </div>
                    <div class="row items-center no-wrap q-gutter-x-xs">
                      <div class="stat-trend-badge" :class="card.trendBadgeClass">
                        <q-icon :name="card.trendIcon" size="12px" />
                      </div>
                      <q-btn v-if="selectedStatKeys.length > 1" flat round dense icon="close" size="xs" color="grey-8"
                        @click="removeStatCard(idx)" />
                    </div>
                  </div>
                  <div class="stat-value">{{ card.value }}</div>
                  <div class="text-caption text-grey-5">{{ card.label }}</div>
                  <div class="stat-footer row justify-between items-center">
                    <span>{{ card.footer }}</span>
                    <!-- Per-card picker: replace this slot with another metric -->
                    <q-btn flat round dense icon="tune" size="xs" color="grey-5">
                      <q-menu>
                        <div class="q-pa-sm text-caption text-grey-6">Replace card</div>
                        <q-list dense style="min-width: 200px">
                          <q-item v-for="k in availableStatTrends" :key="k" clickable dense v-close-popup
                            :active="card.key === k" active-class="text-secondary" @click="setStatCard(idx, k)">
                            <q-item-section>
                              <q-item-label>{{ allTrendData[k]?.label || k }}</q-item-label>
                              <q-item-label caption class="text-grey-5">
                                {{ allTrendData[k] ? (Number.isInteger(allTrendData[k].value) ? allTrendData[k].value :
                                  allTrendData[k].value?.toFixed(1)) + allTrendData[k].unit : '–' }}
                              </q-item-label>
                            </q-item-section>
                            <q-item-section side>
                              <q-icon v-if="card.key === k" name="check" size="14px" color="secondary" />
                            </q-item-section>
                          </q-item>
                        </q-list>
                      </q-menu>
                    </q-btn>
                  </div>
                </q-card-section>
              </q-card>
            </div>
            <!-- Add card placeholder -->
            <div v-if="canAddStatCard" class="col-3">
              <q-card flat bordered class="stat-card-add fit" @click="addStatCard">
                <q-card-section class="column items-center justify-center fit q-pa-md">
                  <q-icon name="add" size="28px" color="grey-5" />
                </q-card-section>
              </q-card>
            </div>
          </div>
        </div>

        <div class="q-px-lg q-pb-lg">
          <div class="progression-content">
            <div class="row items-center q-mb-md">
              <div class="text-h6 col">Progression</div>
              <q-btn outline color="secondary" icon="add" label="Add chart" no-caps
                :disable="progrSlots.length >= 4" @click="addSlot" />
            </div>

            <div class="row q-col-gutter-md">
              <div v-for="(slot, idx) in progrSlots" :key="slot.id" :class="slotColClass">
                <div class="slot-wrapper">
                  <div v-if="progrSlots.length > 1" class="row no-wrap items-center q-mb-xs">
                    <q-space />
                    <q-btn flat round dense size="sm" icon="close" color="grey-6"
                      aria-label="Remove chart" @click="removeSlot(idx)" />
                  </div>

                  <!-- Metric picker rows: primary + optional overlays -->
                  <div v-for="(metric, mIdx) in slot.metrics" :key="mIdx" class="metric-row q-mb-sm">
                    <div class="row q-col-gutter-sm items-center">
                      <div class="col-12 col-md">
                        <q-select dense outlined bg-color="white"
                          :model-value="taskOptionFromTaskValue(metric.taskValue)"
                          :options="progrTaskSelectOptions"
                          :label="mIdx === 0 ? 'Task' : 'Compare with task'"
                          :popup-content-style="{ maxHeight: '260px' }"
                          @update:model-value="setMetricTask(idx, mIdx, $event)" />
                      </div>
                      <div class="col-12 col-md">
                        <q-select dense outlined bg-color="white"
                          :model-value="metric.signalKey"
                          :options="signalOptionsForTaskValue(metric.taskValue)"
                          label="Signal" emit-value map-options
                          :popup-content-style="{ maxHeight: '260px' }"
                          :disable="!metric.taskValue"
                          @update:model-value="setMetricSignal(idx, mIdx, $event)" />
                      </div>
                      <div v-if="slot.metrics.length > 1" class="col-auto">
                        <q-btn flat round dense size="sm" icon="close" color="grey-6"
                          aria-label="Remove metric" @click="removeMetric(idx, mIdx)" />
                      </div>
                    </div>
                  </div>

                  <q-btn flat dense no-caps size="sm" color="secondary" icon="add"
                    :disable="!canAddMetric(slot)"
                    label="Compare with another metric"
                    @click="addMetric(idx)" />

                  <div class="progression-charts q-mt-md">
                    <TaskProgressionCharts :studyDescription="studyDescription" :userKey="userKey"
                      :slot-config="slot" :form-defs="formDefs" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-tab-panel>

      <!-- Activity Log -->
      <q-tab-panel name="activity" class="q-pa-none">
        <participant-activity-log :study-key="studyKey" :user-key="userKey" :study-description="studyDescription" />
      </q-tab-panel>

      <!-- Clinical Notes — not yet implemented -->
      <!-- External Systems — not yet implemented -->

    </q-tab-panels>

  </q-page>
</template>

<script>
import API from '@shared/API.js'
import { bestLocale } from '@mixins/bestLocale'
import { taskTypeToString } from '@i18n/utils'

import TaskProgressionCharts from './TaskProgressionCharts.vue'
import PatientTrends from './PatientTrends.vue'
import ParticipantActivityLog from './ParticipantActivityLog.vue'
import { listSignalsForTask, describeSignal } from './signalCatalog.js'

// Upper bound on how many metrics can be compared in a single chart slot
const MAX_METRICS_PER_SLOT = 2

export default {
  name: 'ParticipantSummaryPage',
  props: ['studyKey', 'userKey'],
  mixins: [bestLocale],
  components: {
    TaskProgressionCharts,
    PatientTrends,
    ParticipantActivityLog
  },
  data () {
    return {
      participant: {},
      studyDescription: {},

      // for progression charts:
      progrTaskSelectOptions: [],
      // 1–4 chart slots. Each slot has 1–4 metrics; each metric is a
      // (taskValue, signalKey) pair. The first metric is the primary;
      // additional metrics overlay as extra lines/datasets.
      progrSlots: [],
      // Form definitions indexed by taskId, preloaded so the signal
      // picker can resolve form signal labels synchronously.
      formDefs: {},
      // Monotonic id used as :key on each slot to keep Vue's vdom stable
      // when slots are added/removed.
      nextSlotId: 1,

      // trend data populated by ParticipantTrendsBar via @trendsLoaded
      allTrendData: {},
      availableTrends: [],

      // which 4 keys to show in the stat cards (customizable, persisted)
      selectedStatKeys: [],

      // tab navigation
      activeTab: 'progression'
    }
  },
  computed: {
    availableStatTrends () {
      return this.availableTrends.filter(k => this.allTrendData[k])
    },
    canAddStatCard () {
      return this.selectedStatKeys.length < 4 &&
        this.availableStatTrends.some(k => !this.selectedStatKeys.includes(k))
    },
    slotColClass () {
      // Single chart fills the row; 2–4 charts each take half on desktop
      // (col-md-6) and stack on narrow viewports (col-12).
      return this.progrSlots.length === 1 ? 'col-12' : 'col-12 col-md-6'
    },
    slotStorageKey () {
      // v2 schema (slot = { metrics: [{taskValue, signalKey}] }). v1 keys
      // remain in localStorage but are ignored — users will see one empty
      // slot first time after the upgrade.
      return `progr-slots-v2-${this.studyKey}-${this.userKey}`
    },
    // Display-ready configs for the 4 selected stat cards
    statCardDefs () {
      return this.selectedStatKeys.map(key => {
        const m = this.allTrendData[key]
        const v = m && typeof m.value === 'number' && !Number.isInteger(m.value) ? m.value.toFixed(1) : m?.value
        return {
          key,
          label: m ? m.label : key,
          value: m ? `${v}${m.unit}` : '—',
          icon: m?.icon || 'show_chart',
          trend: m?.trend || 'stable',
          trendIcon: m?.trend === 'up' ? 'trending_up' : m?.trend === 'down' ? 'trending_down' : 'remove',
          isAlert: m?.isPain && m.value >= 5,
          trendBadgeClass: this._statTrendBadgeClass(key),
          footer: m ? this._statCardFooter(key) : 'No data yet'
        }
      })
    }
  },
  async created () {
    try {
      this.participant = await API.getOneParticipant(this.userKey)
    } catch (err) {
      console.error(err)
      this.$q.notify({
        color: 'negative',
        message: 'Cannot retrieve participant information',
        icon: 'report_problem'
      })
    }

    try {
      this.studyDescription = await API.getStudy(this.studyKey)

      const taskOptions = []

      for (const task of this.studyDescription.tasks) {
        if (task.type === 'form') {
          // forms must be separated by form name
          taskOptions.push({
            label: this.getBestLocale(task.formName),
            value: {
              type: task.type,
              ids: [task.id]
            }
          })
        } else {
          // lump all non forms together
          const opt = taskOptions.find(t => t.value.type === task.type)
          if (!opt) {
            taskOptions.push({
              label: taskTypeToString(task.type),
              value: {
                type: task.type,
                ids: [task.id]
              }
            })
          } else {
            opt.value.ids.push(task.id)
          }
        }
      }
      this.progrTaskSelectOptions = taskOptions

      // Preload form definitions so the signal-picker can list signals
      // synchronously when the user opens a form's signal dropdown.
      const formTasks = (this.studyDescription.tasks || []).filter(t => t.type === 'form')
      await Promise.all(formTasks.map(async (t) => {
        try {
          const def = await API.getForm(t.formKey)
          if (def) this.formDefs[t.id] = def
        } catch (err) {
          console.warn('Could not preload form definition', t.id, err)
        }
      }))

      // Restore previously chosen slots for this (study × patient).
      // Tasks/signals that no longer exist are reset to empty silently.
      const loaded = this._loadSlots()
      this.progrSlots = (loaded && loaded.length) ? loaded : [this._emptySlot()]
    } catch (err) {
      console.error(err)
      this.$q.notify({
        color: 'negative',
        message: 'Cannot retrieve study plan',
        icon: 'report_problem'
      })
    }
  },
  watch: {
    progrSlots: {
      handler () {
        this._saveSlots()
      },
      deep: true
    }
  },
  methods: {
    onTrendsLoaded ({ allTrendData, availableTrends }) {
      this.allTrendData = allTrendData
      this.availableTrends = availableTrends
      const statStorageKey = `stat-cards-${this.studyKey}-${this.userKey}`
      const defaultStatKeys = availableTrends.slice(0, 1)
      try {
        const saved = JSON.parse(localStorage.getItem(statStorageKey))
        if (Array.isArray(saved) && saved.length) {
          const valid = saved.filter(k => availableTrends.includes(k)).slice(0, 4)
          this.selectedStatKeys = valid.length ? valid : defaultStatKeys
        } else {
          this.selectedStatKeys = defaultStatKeys
        }
      } catch {
        this.selectedStatKeys = defaultStatKeys
      }
    },
    _statTrendBadgeClass (key) {
      const m = this.allTrendData[key]
      if (!m) return 'stat-trend-badge--stable'
      if (m.isPain) return m.trend === 'up' ? 'stat-trend-badge--up-alert' : m.trend === 'down' ? 'stat-trend-badge--down-good' : 'stat-trend-badge--stable'
      return m.trend === 'up' ? 'stat-trend-badge--up-good' : m.trend === 'down' ? 'stat-trend-badge--down-bad' : 'stat-trend-badge--stable'
    },
    _statCardFooter (key) {
      const m = this.allTrendData[key]
      if (!m) return 'No data yet'
      if (m.isPain) {
        const map = { up: 'Worsening trend', down: 'Improving trend', stable: 'Stable' }
        return map[m.trend] || 'Stable'
      }
      const map = { up: 'Increasing', down: 'Decreasing', stable: 'Stable' }
      return map[m.trend] || 'Stable'
    },
    setStatCard (idx, newKey) {
      this.selectedStatKeys.splice(idx, 1, newKey)
      localStorage.setItem(
        `stat-cards-${this.studyKey}-${this.userKey}`,
        JSON.stringify(this.selectedStatKeys)
      )
    },
    addStatCard () {
      if (!this.canAddStatCard) return
      const next = this.availableStatTrends.find(k => !this.selectedStatKeys.includes(k))
      if (!next) return
      this.selectedStatKeys.push(next)
      localStorage.setItem(
        `stat-cards-${this.studyKey}-${this.userKey}`,
        JSON.stringify(this.selectedStatKeys)
      )
    },
    removeStatCard (idx) {
      if (this.selectedStatKeys.length <= 1) return
      this.selectedStatKeys.splice(idx, 1)
      localStorage.setItem(
        `stat-cards-${this.studyKey}-${this.userKey}`,
        JSON.stringify(this.selectedStatKeys)
      )
    },
    /**
     * Closes the current tab
     */
    closeTab () {
      window.close()
    },

    // ── Slot / metric helpers ─────────────────────────────────────────
    _emptyMetric () {
      return { taskValue: null, signalKey: null }
    },
    _emptySlot () {
      return { id: `slot-${this.nextSlotId++}`, metrics: [this._emptyMetric()] }
    },
    addSlot () {
      if (this.progrSlots.length >= 4) return
      this.progrSlots.push(this._emptySlot())
    },
    removeSlot (idx) {
      if (this.progrSlots.length <= 1) return
      this.progrSlots.splice(idx, 1)
    },
    addMetric (slotIdx) {
      const slot = this.progrSlots[slotIdx]
      if (!slot || !this.canAddMetric(slot)) return
      const newSlot = { ...slot, metrics: [...slot.metrics, this._emptyMetric()] }
      this.progrSlots.splice(slotIdx, 1, newSlot)
    },
    removeMetric (slotIdx, mIdx) {
      const slot = this.progrSlots[slotIdx]
      if (!slot || slot.metrics.length <= 1) return
      const metrics = slot.metrics.slice()
      metrics.splice(mIdx, 1)
      this.progrSlots.splice(slotIdx, 1, { ...slot, metrics })
    },
    async setMetricTask (slotIdx, mIdx, taskOpt) {
      const slot = this.progrSlots[slotIdx]
      if (!slot) return

      if (!taskOpt) {
        this._patchMetric(slotIdx, mIdx, this._emptyMetric())
        return
      }

      const taskValue = { type: taskOpt.value.type, ids: taskOpt.value.ids.slice() }

      // if preload didn't complete (or failed) for
      // this form, fetch its definition now so the signal picker is
      // never empty when a real form is selected.
      if (taskValue.type === 'form') {
        await this._ensureFormDef(taskValue.ids[0])
      }

      const sigOpts = this.signalOptionsForTaskValue(taskValue)
      // Auto-select the signal when there's exactly one, avoids the
      // friction of a second click for single-signal forms like Pain Level.
      const autoSignal = sigOpts.length === 1 ? sigOpts[0].value : null

      this._patchMetric(slotIdx, mIdx, { taskValue, signalKey: autoSignal })
    },
    _patchMetric (slotIdx, mIdx, newMetric) {
      const slot = this.progrSlots[slotIdx]
      if (!slot) return
      const metrics = slot.metrics.slice()
      metrics.splice(mIdx, 1, newMetric)
      this.progrSlots.splice(slotIdx, 1, { ...slot, metrics })
    },
    async _ensureFormDef (taskId) {
      if (this.formDefs[taskId]) return this.formDefs[taskId]
      const task = (this.studyDescription.tasks || []).find(t => t.id === parseInt(taskId))
      if (!task || !task.formKey) return null
      try {
        const def = await API.getForm(task.formKey)
        if (def) this.formDefs[taskId] = def
        return def
      } catch (err) {
        console.warn('Could not load form definition', taskId, err)
        return null
      }
    },
    setMetricSignal (slotIdx, mIdx, signalKey) {
      const slot = this.progrSlots[slotIdx]
      if (!slot) return
      const old = slot.metrics[mIdx]
      const metrics = slot.metrics.slice()
      metrics.splice(mIdx, 1, { ...old, signalKey })
      this.progrSlots.splice(slotIdx, 1, { ...slot, metrics })
    },
    canAddMetric (slot) {
      if (!slot || slot.metrics.length >= MAX_METRICS_PER_SLOT) return false
      // Only allow adding a comparison once the primary metric is fully
      const primary = slot.metrics[0]
      if (!primary || !primary.taskValue || !primary.signalKey) return false
      // The "all subscales (trends)" view takes over the whole slot —
      // overlays are not visually meaningful there.
      if (this._isExclusivePresentation(primary.signalKey)) return false
      return true
    },
    _isExclusivePresentation (signalKey) {
      return signalKey === '__alltrends'
    },

    // Picker-data helpers for the signal picker
    taskOptionFromTaskValue (taskValue) {
      if (!taskValue) return null
      return this.progrTaskSelectOptions.find(o =>
        o.value.type === taskValue.type && o.value.ids[0] === taskValue.ids[0]
      ) || null
    },
    signalOptionsForTaskValue (taskValue) {
      if (!taskValue) return []
      const formDef = taskValue.type === 'form' ? this.formDefs[taskValue.ids[0]] : null
      const keys = listSignalsForTask(taskValue.type, formDef)
      return keys.map(k => {
        const desc = describeSignal(taskValue.type, k, formDef)
        return { label: this._resolveLocale(desc.name) || k, value: k }
      })
    },
    _resolveLocale (val) {
      if (!val) return ''
      if (typeof val === 'string') return val
      return this.getBestLocale(val) || ''
    },

    // Slot persistence (per study and patient)
    _saveSlots () {
      if (!this.studyKey || !this.userKey) return
      try {
        const serialisable = this.progrSlots.map(slot => ({
          metrics: slot.metrics.map(m => (m && m.taskValue)
            ? { taskType: m.taskValue.type, taskIds: m.taskValue.ids.slice(), signalKey: m.signalKey || null }
            : null)
        }))
        localStorage.setItem(this.slotStorageKey, JSON.stringify(serialisable))
      } catch {}
    },
    _loadSlots () {
      try {
        const raw = localStorage.getItem(this.slotStorageKey)
        if (!raw) return null
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed) || !parsed.length) return null
        return parsed.slice(0, 4).map(s => {
          const metrics = []
          for (const m of (s.metrics || []).slice(0, MAX_METRICS_PER_SLOT)) {
            if (!m || !m.taskType || !Array.isArray(m.taskIds) || !m.taskIds.length) {
              metrics.push(this._emptyMetric())
              continue
            }
            const taskExists = this.progrTaskSelectOptions.find(o =>
              o.value.type === m.taskType && o.value.ids[0] === m.taskIds[0]
            )
            if (!taskExists) {
              metrics.push(this._emptyMetric())
              continue
            }
            const taskValue = { type: m.taskType, ids: m.taskIds.slice() }
            const sigOpts = this.signalOptionsForTaskValue(taskValue)
            const validSignal = m.signalKey && sigOpts.find(o => o.value === m.signalKey)
            // If the saved signal is gone but the task has one signal, auto-pick it to mirror the picker UX.
            const fallback = !validSignal && sigOpts.length === 1 ? sigOpts[0].value : null
            metrics.push({ taskValue, signalKey: validSignal ? m.signalKey : fallback })
          }
          if (!metrics.length) metrics.push(this._emptyMetric())
          return { id: `slot-${this.nextSlotId++}`, metrics }
        })
      } catch {
        return null
      }
    }
  }
}
</script>

<style scoped>
.tab-nav-bar {
  background: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  min-height: 56px;
}

/* Make each tab wider and give them more breathing room */
.tab-nav-tabs :deep(.q-tab) {
  padding: 0 28px;
  min-width: 160px;
  font-size: 0.9375rem;
  letter-spacing: 0.01em;
}

.tab-panels-bg {
  background: #f3f4f6;
  /* q-tab-panels adds overflow-hidden internally; override so position:sticky works */
  overflow: visible !important;
}

.tab-panels-bg :deep(.q-panel-parent),
.tab-panels-bg :deep(.q-panel) {
  overflow: visible !important;
}

/* ── Stats overview cards ───────────────────────────────────────────── */
.stat-card {
  background: #ffffff;
  border-color: #e5e7eb !important;
  border-radius: 6px !important;
}

.stat-card--alert {
  border-color: #fecaca !important;
  background: rgba(254, 242, 242, 0.4) !important;
}

.stat-card-add {
  background: #f3f4f6;
  border-color: #d1d5db !important;
  border-style: dashed !important;
  border-radius: 6px !important;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  min-height: 100%;
}

.stat-card-add:hover {
  background: #e5e7eb;
  border-color: #9ca3af !important;
}

.stat-icon-wrap {
  padding: 6px;
  border-radius: 6px;
}

.stat-icon-wrap--default {
  background: rgba(95, 141, 152, 0.1);
}

.stat-icon-wrap--alert {
  background: rgba(239, 68, 68, 0.1);
}

.stat-trend-badge {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 0.7rem;
  padding: 2px 7px;
  border-radius: 9999px;
}

.stat-trend-badge--up-good {
  background: #dcfce7;
  color: #16a34a;
}

.stat-trend-badge--down-bad {
  background: #fef3c7;
  color: #b45309;
}

.stat-trend-badge--down-good {
  background: #dcfce7;
  color: #16a34a;
}

.stat-trend-badge--up-alert {
  background: #fee2e2;
  color: #dc2626;
}

.stat-trend-badge--stable {
  background: #f3f4f6;
  color: #6b7280;
}

.stat-value {
  font-size: 1.25rem;
  color: #1f2937;
  margin-top: 4px;
}

.stat-footer {
  font-size: 0.72rem;
  color: #9ca3af;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid #f3f4f6;
}

/* ── Progression tab ───────────────────────────────────────────────── */
.progression-content {
  width: 100%;
}

.progression-charts {
  width: 100%;
}

.slot-wrapper {
  width: 100%;
  position: relative;
  border: 1px solid #d4d8dd;
  border-radius: 8px;
  padding: 12px 14px 14px 14px;
  background: #ffffff;
}

.metric-row :deep(.q-field__control) {
  min-height: 36px;
}

.patient-toolbar {
  min-height: 90px;
  padding: 8px 28px;
  height: auto;
  align-items: flex-start;
}

.patient-name {
  font-size: 1.25rem;
  font-weight: 600;
  white-space: nowrap;
}

.patient-id {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.65);
  white-space: nowrap;
}

.patient-meta {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.65);
  margin-top: 2px;
}

.patient-conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
}

.condition-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 9px;
  border-radius: 9999px;
  font-size: 0.72rem;
  white-space: nowrap;
  user-select: none;
}

.condition-chip--disease {
  background: rgba(239, 68, 68, 0.25);
  color: rgba(255, 200, 200, 0.95);
}

.condition-chip--med {
  background: rgba(96, 165, 250, 0.2);
  color: rgba(180, 220, 255, 0.95);
}
</style>
