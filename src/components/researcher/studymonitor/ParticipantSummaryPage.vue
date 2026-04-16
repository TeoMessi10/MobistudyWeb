<template>
  <q-page>
    <q-toolbar class="bg-secondary text-white patient-toolbar">
      <q-toolbar-title>
        <div class="row items-center no-wrap q-gutter-x-lg">
          <span class="patient-name">{{ participant.name }} {{ participant.surname }}</span>
          <span v-if="participant._key" class="patient-id">· #P-{{ participant._key }}</span>

          <template v-if="availableMetrics.length > 0">
            <div class="patient-divider" />

            <!-- Dynamic metric chips -->
            <div
              v-for="key in selectedMetrics"
              :key="key"
              class="patient-chip"
              :class="chipColorClass(key)"
            >
              <q-icon
                :name="allMetricData[key].icon"
                size="14px"
                class="chip-icon"
                :style="allMetricData[key].iconColor ? `color: ${allMetricData[key].iconColor}` : ''"
              />
              <span class="chip-label">{{ allMetricData[key].label }}</span>
              <span class="chip-value">{{ displayValue(key) }}</span>
              <q-icon
                :name="trendIconName(allMetricData[key].trend)"
                size="14px"
                :class="trendColorClass(key)"
              />
            </div>

            <!-- Metric picker button -->
            <q-btn flat round dense icon="tune" size="sm" color="white" style="opacity: 0.7">
              <q-tooltip>Customize visible metrics</q-tooltip>
              <q-menu anchor="bottom right" self="top right" style="min-width: 220px">
                <div class="q-pa-sm">
                  <div class="row items-center justify-between q-mb-xs q-px-xs">
                    <span class="text-caption text-grey-6">Visible metrics</span>
                    <span class="text-caption" :class="selectedMetrics.length >= 4 ? 'text-negative' : 'text-grey-5'">
                      {{ selectedMetrics.length }}/4
                    </span>
                  </div>
                  <q-list dense>
                    <q-item
                      v-for="m in metricDefs"
                      :key="m.key"
                      tag="label"
                      :disable="!selectedMetrics.includes(m.key) && selectedMetrics.length >= 4"
                      clickable
                      dense
                    >
                      <q-item-section side>
                        <q-checkbox
                          :model-value="selectedMetrics.includes(m.key)"
                          :disable="!selectedMetrics.includes(m.key) && selectedMetrics.length >= 4"
                          dense
                          @update:model-value="toggleMetric(m.key)"
                        />
                      </q-item-section>
                      <q-item-section>
                        <q-item-label>{{ m.label }}</q-item-label>
                        <q-item-label caption class="text-grey-5">
                          Latest: {{ displayValue(m.key) }}
                        </q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                  <div v-if="selectedMetrics.length >= 4" class="text-caption text-negative q-px-xs q-pt-xs">
                    Remove one to add another
                  </div>
                </div>
              </q-menu>
            </q-btn>
          </template>
        </div>
        <div v-if="participant.dateOfBirth || participant.sex" class="patient-meta">
          <span v-if="participant.dateOfBirth">{{ new Date(participant.dateOfBirth).toLocaleDateString('sv-SE') }}</span>
          <span v-if="participant.dateOfBirth && participant.sex"> · </span>
          <span v-if="participant.sex">{{ participant.sex }}</span>
        </div>
      </q-toolbar-title>
      <q-btn round color="black" icon="close" @click="closeTab()" />
    </q-toolbar>

    <!-- Tab navigation bar -->
    <div class="tab-nav-bar">
      <q-tabs
        v-model="activeTab"
        align="left"
        active-color="secondary"
        indicator-color="secondary"
        no-caps
        class="tab-nav-tabs"
      >
        <q-tab name="activity" icon="ssid_chart" label="Activity & Progression" />
        <q-tab name="notes" icon="sticky_note_2" label="Clinical Notes" disable />
        <q-tab name="external" icon="link" label="External Systems" disable />
      </q-tabs>
    </div>

    <!-- Tab content -->
    <q-tab-panels v-model="activeTab" animated class="tab-panels-bg">

      <!-- Activity & Progression -->
      <q-tab-panel name="activity" class="q-pa-none">
        <div class="row no-wrap items-start">

          <!-- Left: scrollable activity log -->
          <div class="col activity-log-col">
            <q-table title="Activity log" :rows="tasks" selection="none" :columns="columns" row-key="_key"
              v-model:pagination="pagination" @request="loadTasksSummary" :loading="loadingTasksSummary">
              <template #body-cell-data="props">
                <q-td :props="props">
                  <q-btn v-if="!props.row.discarded" flat icon="open_in_new" @click="showTaskData(props.row)" />
                </q-td>
              </template>
              <template #body-cell-formName="props">
                <q-td :props="props">
                  {{ showTaskName(props.row.taskId) }}
                </q-td>
              </template>
              <template #body-cell-completedTS="props">
                <q-td :props="props">
                  <div v-if="props.row.discarded">{{ niceTimestamp(props.row.createdTS) }}</div>
                  <div v-else>{{ niceTimestamp(props.row.summary?.completedTS) }}</div>
                </q-td>
              </template>
              <template #body-cell-summary="props">
                <q-td :props="props">
                  <div v-if="props.row.discarded">Discarded</div>
                  <div v-else v-html="taskSummaryToString(props.row.summary, props.row.taskType)"></div>
                </q-td>
              </template>
            </q-table>
          </div>

          <!-- Right: progression panel, stays at top -->
          <div class="col progression-col">
            <q-card>
              <q-card-section>
                <div class="text-h6">Progression</div>
                <q-select square outlined v-model="progrSelectedTasks" :options="progrTaskSelectOptions"
                  label="Select task" />
                <div v-show="!progrSelectedTasks">
                  No task selected
                </div>
                <div>
                  <TaskProgressionCharts :studyDescription="studyDescription" :userKey="userKey"
                    :selectedTasks="progrSelectedTasks" />
                </div>
              </q-card-section>
            </q-card>
          </div>

        </div>
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
import { date } from 'quasar'

import AnswersDialog from './taskResultsDialogs/AnswersDialog.vue'
import DrawingDialog from './taskResultsDialogs/DrawingDialog.vue'
import FingerTappingDialog from './taskResultsDialogs/FingerTappingDialog.vue'
import JStyleDialog from './taskResultsDialogs/JStyleDialog.vue'

import TaskProgressionCharts from './TaskProgressionCharts.vue'

// ── Signal metadata for well-known task type fields ──────────────────────────
const SIGNAL_META = {
  po60__hr: { label: 'Heart Rate', unit: ' bpm', icon: 'favorite_border', iconColor: '#86efac' },
  po60__spo2: { label: 'SpO2', unit: '%', icon: 'air', iconColor: '#86efac' },
  peakFlow__pefMax: { label: 'Peak Flow', unit: ' L/min', icon: 'air', iconColor: '' },
  smwt__distance: { label: 'Walk Distance', unit: ' m', icon: 'directions_walk', iconColor: '' },
  tugt__durationMs: { label: 'TUG Duration', unit: ' ms', icon: 'timer', iconColor: '' },
  fingerTapping__tappingCount: { label: 'Tapping Count', unit: '', icon: 'touch_app', iconColor: '' },
  drawing__totalVariabilitySquare: { label: 'Square Deviation', unit: '', icon: 'square_foot', iconColor: '' },
  drawing__totalVariabilitySpiral: { label: 'Spiral Deviation', unit: '', icon: 'loop', iconColor: '' }
}

// Fields that represent a pain/severity scale (0–10) → colour-coded chips
const PAIN_FIELDS_SET = new Set(['pain', 'painlevel', 'pains', 'vas', 'nrs', 'painscore', 'painscore', 'painScore', 'painLevel'])

// Summary meta-fields that are not meaningful metrics
const SUMMARY_SKIP = new Set(['asked', 'answered', 'completedTS', 'startedTS', 'type'])

// Only these task types produce patient health metrics worth showing in the header.
// position/miband3/jstyle/vocalization/dataQuery are excluded — they produce
// environmental data, raw timestamps, or complex array structures that don't map
// cleanly to a single header value.
const HEALTH_METRIC_TASK_TYPES = new Set([
  'po60', // SpO2, HR
  'peakFlow', // Peak expiratory flow
  'smwt', // 6-minute walk test
  'tugt', // Timed up and go
  'fingerTapping', // Motor function
  'drawing', // Motor function (tremor)
  'holdPhone', // Tremor / balance
  'form' // Researcher-designed health questionnaires
])

// For form tasks, only surface fields whose names suggest clinical relevance.
// Lifestyle / social fields (sex, finances, hobbies, alcohol…) are excluded.
const FORM_CLINICAL_KEYWORDS = [
  'pain', 'ache', 'symptom', 'discomfort',
  'weight', 'height', 'bmi',
  'health', 'function', 'functioning', 'wellbeing', 'quality',
  'score', 'index', 'level', 'scale',
  'pressure', 'glucose', 'oxygen', 'saturation', 'spo2',
  'fatigue', 'mood', 'anxiety', 'depression', 'stress',
  'dyspnea', 'breathless', 'respiratory',
  'exercise', 'activity', 'mobility', 'balance',
  'medication', 'adherence', 'dose',
  'sleep', 'insomnia',
  'cognitive', 'memory', 'concentration'
]

function isClinicallRelevantFormField (fieldName) {
  const lower = fieldName.toLowerCase()
  if (PAIN_FIELDS_SET.has(lower)) return true
  return FORM_CLINICAL_KEYWORDS.some(kw => lower.includes(kw))
}

// Convert camelCase field name to a readable label
function fieldToLabel (field) {
  return field
    .replace(/\./g, ' › ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim()
}

export default {
  name: 'ParticipantSummaryPage',
  props: ['studyKey', 'userKey'],
  mixins: [bestLocale],
  components: {
    TaskProgressionCharts
  },
  data () {
    return {
      participant: {},
      studyDescription: {},
      // for the summary table:
      tasks: [],
      columns: [
        { name: 'data', required: false, label: '', align: 'center', field: 'data', sortable: false },
        { name: 'formName', required: true, label: 'Task', align: 'center', field: 'formName' },
        { name: 'summary', required: true, label: 'Summary', align: 'center', field: 'summary', sortable: false },
        { name: 'completedTS', required: true, label: 'Completed', align: 'center', field: 'completedTS', sortable: false }
      ],
      pagination: { page: 1, rowsPerPage: 20, rowsNumber: 0 },
      loadingTasksSummary: false,

      // for progression charts:
      progrTaskSelectOptions: [],
      progrSelectedTasks: null,

      // header metrics
      allMetricData: {},
      availableMetrics: [],
      selectedMetrics: [],

      // tab navigation
      activeTab: 'activity'
    }
  },
  computed: {
    metricDefs () {
      return this.availableMetrics.map(k => ({
        key: k,
        label: this.allMetricData[k]?.label || k
      }))
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

      // now that we have the study description, load header metrics
      this.loadLatestMetrics()
    } catch (err) {
      console.error(err)
      this.$q.notify({
        color: 'negative',
        message: 'Cannot retrieve study plan',
        icon: 'report_problem'
      })
    }

    this.loadTasksSummary()
  },
  methods: {
    /**
     * Scans all task results to discover every available numeric metric,
     * computes latest values and trends, then updates the header chip data.
     */
    async loadLatestMetrics () {
      if (!this.studyDescription.tasks || this.studyDescription.tasks.length === 0) return
      try {
        const allTaskIds = this.studyDescription.tasks.map(t => t.id)
        const allResults = await API.getTasksResults(this.studyKey, this.userKey, allTaskIds)
        if (!allResults || !Array.isArray(allResults) || allResults.length === 0) return

        // ── Collect time-series per metric key ──────────────────────────
        const collections = {}
        for (const result of allResults) {
          if (result.discarded || !result.summary) continue
          const taskType = result.taskType
          if (!HEALTH_METRIC_TASK_TYPES.has(taskType)) continue
          const entryDate = new Date(result.summary.completedTS || result.createdTS)
          const fields = this._extractNumericFields(result.summary)
          for (const [field, value] of Object.entries(fields)) {
            // For form tasks, skip fields that don't match clinical keywords
            if (taskType === 'form' && !isClinicallRelevantFormField(field)) continue
            const key = `${taskType}__${field}`
            if (!collections[key]) collections[key] = []
            collections[key].push({ value, date: entryDate })
          }
        }

        // ── Build allMetricData from the collections ────────────────────
        const newData = {}
        for (const [key, entries] of Object.entries(collections)) {
          entries.sort((a, b) => b.date - a.date)
          const latest = entries[0].value
          const prev = entries.length > 1 ? entries[1].value : null
          const trend = prev === null ? 'stable' : latest > prev ? 'up' : latest < prev ? 'down' : 'stable'
          const fieldName = key.split('__')[1]
          const meta = SIGNAL_META[key] || {}
          const isPain = PAIN_FIELDS_SET.has(fieldName.split('.').pop().toLowerCase())
          newData[key] = {
            label: meta.label || fieldToLabel(fieldName),
            value: latest,
            unit: meta.unit ?? '',
            icon: meta.icon || 'show_chart',
            iconColor: meta.iconColor || '',
            trend,
            isPain
          }
        }

        // ── Adherence (special computed metric) ────────────────────────
        const completed = allResults.filter(r => !r.discarded).length
        let adherenceTrend = 'stable'
        if (allResults.length >= 4) {
          const mid = Math.floor(allResults.length / 2)
          const ra = allResults.slice(0, mid).filter(r => !r.discarded).length / mid
          const oa = allResults.slice(mid).filter(r => !r.discarded).length / (allResults.length - mid)
          adherenceTrend = ra > oa + 0.05 ? 'up' : ra < oa - 0.05 ? 'down' : 'stable'
        }
        newData.adherence = {
          label: 'Adherence',
          value: Math.round((completed / allResults.length) * 100),
          unit: '%',
          icon: 'task_alt',
          iconColor: '#fde68a',
          trend: adherenceTrend,
          isPain: false
        }

        this.allMetricData = newData
        const available = Object.keys(newData)
        this.availableMetrics = available

        // ── Load saved selection (fall back to all available) ───────────
        const storageKey = `header-metrics-${this.studyKey}-${this.userKey}`
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey))
          this.selectedMetrics = Array.isArray(saved)
            ? saved.filter(k => available.includes(k)).slice(0, 4)
            : available.slice(0, 4)
        } catch {
          this.selectedMetrics = [...available]
        }
      } catch (err) {
        console.error('Cannot load header metrics:', err)
      }
    },
    /**
     * Recursively extracts flat numeric fields from a summary object,
     * skipping meta-fields (timestamps, counts, etc.).
     */
    _extractNumericFields (obj, prefix = '', depth = 0) {
      const result = {}
      if (depth > 3 || typeof obj !== 'object' || obj === null) return result
      for (const [k, v] of Object.entries(obj)) {
        if (SUMMARY_SKIP.has(k) || Array.isArray(v)) continue
        const key = prefix ? `${prefix}.${k}` : k
        if (typeof v === 'number') result[key] = v
        else if (typeof v === 'object') Object.assign(result, this._extractNumericFields(v, key, depth + 1))
      }
      return result
    },
    chipColorClass (key) {
      const m = this.allMetricData[key]
      if (!m?.isPain) return ''
      if (m.value >= 7) return 'patient-chip--pain-red'
      if (m.value >= 4) return 'patient-chip--pain-yellow'
      return 'patient-chip--pain-green'
    },
    trendIconName (trend) {
      return trend === 'up' ? 'trending_up' : trend === 'down' ? 'trending_down' : 'remove'
    },
    trendColorClass (key) {
      const m = this.allMetricData[key]
      const trend = m?.trend
      if (!trend || trend === 'stable') return 'trend-stable'
      if (m?.isPain) {
        // for pain: going up is worse
        return trend === 'up' ? 'trend-up' : 'trend-stable'
      }
      return trend === 'up' ? 'trend-stable' : 'trend-down'
    },
    displayValue (key) {
      const m = this.allMetricData[key]
      if (!m) return '–'
      const v = typeof m.value === 'number' && !Number.isInteger(m.value)
        ? m.value.toFixed(1)
        : m.value
      return `${v}${m.unit}`
    },
    toggleMetric (key) {
      const idx = this.selectedMetrics.indexOf(key)
      if (idx === -1) {
        if (this.selectedMetrics.length >= 4) return
        this.selectedMetrics.push(key)
      } else {
        this.selectedMetrics.splice(idx, 1)
      }
      localStorage.setItem(
        `header-metrics-${this.studyKey}-${this.userKey}`,
        JSON.stringify(this.selectedMetrics)
      )
    },
    /**
     * Closes the current tab
     */
    closeTab () {
      window.close()
    },
    niceTimestamp (timeStamp) {
      return date.formatDate(timeStamp, 'YYYY-MM-DD HH:mm:ss')
    },
    firstLetterUpperCase (str) {
      return str.charAt(0).toUpperCase() + str.slice(1)
    },
    /**
     * Formats the task name in a readable string
     */
    showTaskName (taskId) {
      const task = this.studyDescription.tasks.find(t => t.id === taskId)
      if (!task) return 'Unknown task'
      if (task.customTitle) {
        return this.getBestLocale(task.customTitle)
      }
      const taskType = task.type
      if (taskType === 'form' && task.formName) return this.getBestLocale(task.formName)
      return this.firstLetterUpperCase(taskType)
    },
    /**
     * Loads the tasks summary table for that participant
     */
    async loadTasksSummary (params) {
      this.loadingTasksSummary = true
      if (params) this.pagination = params.pagination
      const offset = (this.pagination.page - 1) * this.pagination.rowsPerPage
      const count = this.pagination.rowsPerPage
      try {
        const resp = await API.getTasksResults(this.studyKey, this.userKey, null, offset, count)
        this.tasks = resp.subset
        this.pagination.rowsNumber = resp.totalCount
      } catch (err) {
        this.$q.notify({
          color: 'negative',
          message: 'Cannot retrieve tasks',
          icon: 'report_problem'
        })
      }
      this.loadingTasksSummary = false
    },
    /**
     * Opens a dialog with the task results details
     */
    async showTaskData (taskResult) {
      let component
      if (taskResult.taskType === 'form') component = AnswersDialog
      if (taskResult.taskType === 'drawing') component = DrawingDialog
      if (taskResult.taskType === 'fingerTapping') component = FingerTappingDialog
      if (taskResult.taskType === 'jstyle') component = JStyleDialog
      this.$q.dialog({
        // component loaded into the dialog
        component,
        // props forwarded to custom component
        componentProps: {
          taskResult,
          taskName: this.showTaskName(taskResult.taskId)
        }
      })
    },
    /**
     * Formats the task summary to a readable string
     */
    taskSummaryToString (summary, taskType) {
      let retString = ''
      if (taskType === 'form') {
        retString += 'Answered: ' + summary.answered + ' of ' + summary.asked
        for (const prop in summary) {
          if (prop !== 'answered' &&
            prop !== 'asked' &&
            prop !== 'startedTS' &&
            prop !== 'completedTS') {
            if (typeof summary[prop] === 'string') {
              retString += '<br>' + this.firstLetterUpperCase(prop) + ': ' + summary[prop]
            } else if (typeof summary[prop] === 'number') {
              retString += '<br>' + this.firstLetterUpperCase(prop) + ': ' + summary[prop].toFixed(0)
            }
          }
        }
      } else if (taskType === 'dataQuery') {
        retString += 'Type: ' + summary.type
      } else if (taskType === 'drawing') {
        retString += 'Square deviation: ' + summary.totalVariabilitySquare.toFixed(0) + '<br>'
        retString += 'Spiral deviation: ' + summary.totalVariabilitySpiral.toFixed(0) + '<br>'
      } else if (taskType === 'fingerTapping') {
        retString += 'Taps count: ' + summary.tappingCount + '<br>'
      } else if (taskType === 'vocalization') {
        for (const phase of summary.phases) {
          const timeDiffSecs = (new Date(phase.completedTS).getTime() - new Date(phase.startedTS).getTime()) / 1000
          retString += 'Vowel ' + phase.vocal.toUpperCase() + ' : ' + Math.round(timeDiffSecs) + ' sec <br>'
        }
      } else if (taskType === 'holdPhone') {
        retString += 'Resting accel variance L ' + summary.resting.left.accelerationVariance.toFixed(2)
        retString += ' - R ' + summary.resting.right.accelerationVariance.toFixed(2) + '<br>'
        retString += 'Postural accel variance L ' + summary.postural.left.accelerationVariance.toFixed(2)
        retString += ' - R ' + summary.postural.right.accelerationVariance.toFixed(2) + '<br>'
        retString += 'Kinetic accel variance L ' + summary.postural.left.accelerationVariance.toFixed(2)
        retString += ' - R ' + summary.kinetic.right.accelerationVariance.toFixed(2)
      } else if (taskType === 'tugt') {
        retString += 'Duration: ' + (summary.durationMs / 1000).toFixed(0) + ' sec'
      } else if (taskType === 'miband3') {
        retString += 'From: ' + summary.firstTS.slice(0, 10) + ' to: ' + summary.lastTS.slice(0, 10)
      } else if (taskType === 'peakFlow') {
        retString += 'PEF Max: ' + summary.pefMax
      } else if (taskType === 'po60') {
        retString += 'SPO2: ' + summary.spo2 + ', HR: ' + summary.hr
      } else if (taskType === 'position') {
        retString += 'Location: ' + summary.location + '<br>'
        retString += 'Weather: ' + summary.weather + '<br>'
        retString += 'Temperature: ' + summary.temperature + '<br>'
        retString += 'Air quality: ' + summary.aqi
      } else if (taskType === 'smwt') {
        retString += 'Distance: ' + summary.distance.toFixed(0) + 'm'
      } else if (taskType === 'jstyle') {
        if (summary.activitySummary && summary.activitySummary.length > 0) {
          for (let i = 0; i < summary.activitySummary.length; i++) {
            if (i > 0) retString += '<br>'
            retString += 'Date: ' + summary.activitySummary[i].date.slice(0, 10) + ' - Steps: ' + summary.activitySummary[i].steps
          }
        } else {
          retString += 'From: ' + summary.firstTS.slice(0, 10) + ' to ' + summary.lastTS.slice(0, 10)
        }
      }
      return retString
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

.tab-nav-tabs {
  padding: 0 24px;
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

.activity-log-col {
  padding: 16px;
  min-width: 0;
}

.progression-col {
  padding: 16px;
  flex-shrink: 0;
  width: 480px;
  position: sticky;
  top: 66px;
  align-self: flex-start;
}

.patient-toolbar {
  min-height: 90px;
  padding: 0 28px;
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

.patient-divider {
  width: 1px;
  height: 26px;
  background: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
}

.patient-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 13px;
  border-radius: 9999px;
  font-size: 0.8125rem;
  background: rgba(255, 255, 255, 0.15);
  white-space: nowrap;
  cursor: default;
  user-select: none;
}

.patient-chip--pain-red {
  background: rgba(239, 68, 68, 0.3);
  outline: 1px solid rgba(239, 68, 68, 0.5);
}

.patient-chip--pain-yellow {
  background: rgba(234, 179, 8, 0.3);
  outline: 1px solid rgba(234, 179, 8, 0.5);
}

.patient-chip--pain-green {
  background: rgba(34, 197, 94, 0.25);
  outline: 1px solid rgba(34, 197, 94, 0.45);
}

.chip-label {
  color: rgba(255, 255, 255, 0.85);
}

.chip-value {
  color: #ffffff;
  font-weight: 500;
}

.chip-icon {
  color: rgba(255, 255, 255, 0.8);
}

.chip-icon--green {
  color: #86efac;
}

.chip-icon--yellow {
  color: #fde68a;
}

.trend-up {
  color: #fca5a5;
}

.trend-down {
  color: #fde68a;
}

.trend-stable {
  color: #86efac;
}
</style>
