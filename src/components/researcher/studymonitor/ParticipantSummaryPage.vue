<template>
  <q-page>
    <q-toolbar class="bg-secondary text-white q-pa-md">
      <q-toolbar-title>
        <strong>{{ participant.name }} {{ participant.surname }}</strong>
      </q-toolbar-title>
      <q-btn class="float-right q-mr-md" round color="black" icon="close" @click="closeTab()" />
    </q-toolbar>

    <div class="row">

      <div class="q-ma-md col">
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

      <q-card class="q-ma-md col">
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
      progrSelectedTasks: null
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
