<template>
  <div v-if="loaded">
    <div v-for="(dataset, signal) of chartDataSets" :key="signal">
      <p>{{ chartOptions[signal].description }}</p>
      <Scatter :data="{ labels, datasets: dataset }" :options="chartOptions[signal]" />
    </div>
  </div>
  <h5 v-if="unsupported" style="q-mt-md">Task type currently unsupported</h5>
</template>

<script>
import API from '@shared/API.js'
import { bestLocale } from '@mixins/bestLocale'
import { taskTypeToString } from '@i18n/utils'

import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  CategoryScale,
  PointElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import { Scatter } from 'vue-chartjs'

import 'chartjs-adapter-luxon'
import zoomPlugin from 'chartjs-plugin-zoom'

ChartJS.register(
  TimeScale,
  LinearScale,
  CategoryScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin
)

const COLORS = [
  '#4dc9f6',
  '#f67019',
  '#f53794',
  '#537bc4',
  '#acc236',
  '#166a8f',
  '#00a950',
  '#58595b',
  '#8549ba'
]

export default {
  name: 'ParticipantSummaryPage',
  props: ['studyDescription', 'userKey', 'selectedTasks'],
  mixins: [bestLocale],
  components: {
    // eslint-disable-next-line vue/no-reserved-component-names
    Scatter
  },
  data () {
    return {
      loaded: false,
      unsupported: false,
      labels: [],
      chartDataSets: {},
      chartOptions: {}
    }
  },
  watch: {
    /**
     * Creates the charts for the selected tasks
     * @param newTasks - array of task ids, all tasks must be of the same type
     * @param oldTasks - unused
     */
    async selectedTasks (newTasks, oldTasks) {
      this.loaded = false
      this.unsupported = false

      const studykey = this.studyDescription._key
      // the task type should be the same for all task ids passed
      // we can just take the first
      const taskDescr = this.studyDescription.tasks.find(t => t.id === parseInt(newTasks.value.ids[0]))
      const taskType = taskDescr.type
      let formDef
      if (taskType === 'form') {
        // get the form definition to know which signals to show
        formDef = await API.getForm(taskDescr.formKey)
        if (!formDef) {
          this.unsupported = true
          return
        }
      }
      const signals = this.getSummarySignalsNames(taskType, formDef)

      if (!signals) {
        this.unsupported = true
        return
      }

      // initialize the dataset for each signal
      // we keep the same labels for all charts
      this.labels = []
      this.chartDataSets = {} // we need an array per signal
      // table relating the task id -> the dataset index in the datasets array
      const taskidDatasetIndex = {}

      for (const signal of signals) {
        // initialise datasets arrays
        this.chartDataSets[signal] = []

        // initialise the chart options
        this.chartOptions[signal] = {
          responsive: true,
          // maintainAspectRatio: false,
          scales: {
            x: {
              type: 'time',
              time: {
                minUnit: 'minute',
                unit: 'day',
                // Luxon format string
                tooltipFormat: 'DD T'
              },
              title: {
                display: true,
                text: 'time'
              }
            },
            y: {
              title: {
                display: true,
                text: this.signalToUnitString(signal)
              }
            }
          },
          plugins: {
            title: {
              display: true,
              text: this.signalToString(signal, formDef),
              color: '#459399',
              font: {
                size: 16
              }
            },
            legend: {
              display: newTasks.length > 1,
              position: 'top'
            }
          }
        }
        this.chartOptions[signal].description = this.signalToDescriptionString(signal, formDef)

        // if the form definition specifies that the signal type is "category"
        if (formDef && formDef.summaryFunctionDescription &&
          signal in formDef.summaryFunctionDescription &&
          formDef.summaryFunctionDescription[signal].type === 'category') {
          // add the categories to the chart options
          this.chartOptions[signal].categories = formDef.summaryFunctionDescription[signal].categories
          // add category options to the y axis
          this.chartOptions[signal].scales.y = {
            type: 'category',
            offset: true,
            labels: Object.values(formDef.summaryFunctionDescription[signal].categories).map((entry) => this.getBestLocale(entry.name)),
            title: {
              display: true,
              text: this.signalToUnitString(signal)
            }
          }
        }
      }

      // helper function to find a date in an array of dates
      function findDateInArray (array, value) {
        return array.findIndex(item => { return item.getTime() === value.getTime() })
      }

      // get indicators to show, this depends on the task type
      if (taskType === 'jstyle') {
        // retrieve the indicators
        // studyKey, userKey, taskIds, producer, offset, count
        let jstyleIndicators = []
        const dailyActivityIndicators = await API.getTaskResultsIndicators(studykey, this.userKey, newTasks.value.ids, 'jstyle-activity-daily-stats')
        jstyleIndicators = jstyleIndicators.concat(dailyActivityIndicators)
        const dailySleepIndicators = await API.getTaskResultsIndicators(studykey, this.userKey, newTasks.value.ids, 'jstyle-sleep-daily-stats')
        jstyleIndicators = jstyleIndicators.concat(dailySleepIndicators)
        if (!jstyleIndicators || jstyleIndicators.length === 0) {
          this.loaded = true
          return
        }
        // sort by date ascending
        jstyleIndicators.sort((a, b) => { return (new Date(a.indicatorsDate) - new Date(b.indicatorsDate)) })

        // jstyle indicators can be associated to multiple task ids, but it's meaningless to show multiple times the same datapoint
        // so we will just pick one task id to associate the datapoint to
        const taskId = newTasks.value.ids[0]

        // now populate the datasets
        // this.chartDataSets[signal][dataSetIndex] contains all the datapoints for that task/signal
        // for example, for signal 'steps', dataSetIndex 0 will contain the datapoints for the first task id
        for (const indicatorSet of jstyleIndicators) {
          // for each indicator, we need to add its date and the values to the datasets
          const date = new Date(indicatorSet.indicatorsDate)
          if (findDateInArray(this.labels, date) === -1) {
            this.labels.push(date)
          }
          for (const signal of signals) {
            // add the datapoint inside the dataset
            if (indicatorSet.indicators[signal]) {
              // as there is only one task id, the dataset index is always 0
              const dataSetIndex = 0

              // initialise the dataset, there is one per signal
              if (!this.chartDataSets[signal][dataSetIndex]) {
                this.chartDataSets[signal][dataSetIndex] = {
                  taskId,
                  label: 'JStyle Activity Monitor',
                  borderColor: COLORS[taskId % COLORS.length],
                  backgroundColor: COLORS[taskId % COLORS.length],
                  showLine: false,
                  data: []
                }
              }

              // add the signal to the dataset
              this.chartDataSets[signal][dataSetIndex].data.push(indicatorSet.indicators[signal])
            }
          }
        }
      } else {
        // other task types, use task results summaries to populate the charts
        const resp = await API.getTasksResults(studykey, this.userKey, newTasks.value.ids)

        // for each task, populate the labels first (the dates)
        for (const taskRes of resp) {
          if (!taskRes.discarded) {
            let date
            if (taskRes.summary.completedTS) date = new Date(taskRes.summary.completedTS)
            else date = new Date(taskRes.createdTS)
            // add the date to the results, so we don't need to recalcuate it later
            taskRes.date = date
            // add the label (date) if not already present
            if (findDateInArray(this.labels, date) === -1) {
              this.labels.push(date)
            }
          }
        }

        // results are sorted ascending from API, however each task comes with different dates, so we need to re-sort
        this.labels.sort()
        // now re-iterate for the datapoints
        for (const taskRes of resp) {
          if (!taskRes.discarded) {
            const taskId = taskRes.taskId

            // get the name of the task
            let taskName = 'Unknown task'
            const task = this.studyDescription.tasks.find(t => t.id === parseInt(taskId))
            if (task.customTitle) {
              taskName = this.getBestLocale(task.customTitle)
            } else {
              if (taskType === 'form' && task.formName) taskName = this.getBestLocale(task.formName)
              else taskName = taskTypeToString(taskType)
            }

            // per each "signal" build up an array of datasets, one per taskId
            // each dataset contains all the datapoints for that task/signal
            for (const signal of signals) {
              // get the index this task id has in the sequence of datasets:
              let dataSetIndex
              if (taskId in taskidDatasetIndex) {
                dataSetIndex = taskidDatasetIndex[taskId]
              } else {
                // this is a new task we are adding, the index will be the one after the last available one
                dataSetIndex = this.chartDataSets[signal].length
                taskidDatasetIndex[taskId] = dataSetIndex
              }

              // initialise the dataset, there is one per signal and task id
              if (!this.chartDataSets[signal][dataSetIndex]) {
                this.chartDataSets[signal][dataSetIndex] = {
                  taskId,
                  label: taskName,
                  borderColor: COLORS[taskId % COLORS.length],
                  backgroundColor: COLORS[taskId % COLORS.length],
                  showLine: false,
                  data: []
                }
              }

              // add the datapoint inside the dataset at the position of the date
              {
                // index of the datapoint with respect to its date
                const Idx = findDateInArray(this.labels, taskRes.date)
                let value = signal.split('.').reduce((p, c) => p?.[c], taskRes.summary)

                // if the value is a category, we need to convert it to the corresponding label
                if (this.chartOptions[signal].scales.y.type === 'category') {
                  value = this.getBestLocale(this.chartOptions[signal].categories[value].name)
                }
                this.chartDataSets[signal][dataSetIndex].data[Idx] = value
              }
            }
          }
        }
      }

      this.loaded = true
    }
  },
  methods: {
    getDayString (aDate) {
      aDate = new Date(aDate)
      const offset = aDate.getTimezoneOffset()
      aDate = new Date(aDate.getTime() - (offset * 60 * 1000))
      return aDate.toISOString().split('T')[0]
    },
    getSummarySignalsNames (taskType, formDef) {
      if (taskType === 'form') {
        if (!formDef) return null
        if (formDef.summaryFunction && formDef.summaryFunctionDescription) {
          // if the form definition contains a summary function description, we use it to determine which signals to show
          return Object.keys(formDef.summaryFunctionDescription)
        }
      }
      if (taskType === 'tugt') return ['durationMs']
      if (taskType === 'fingerTapping') return ['tappingCount']
      if (taskType === 'drawing') return ['totalVariabilitySquare', 'totalVariabilitySpiral']
      if (taskType === 'holdPhone') return ['resting.left.accelerationVariance', 'resting.right.accelerationVariance', 'postural.left.accelerationVariance', 'postural.right.accelerationVariance', 'kinetic.left.accelerationVariance', 'kinetic.right.accelerationVariance']
      if (taskType === 'peakFlow') return ['pefMax']
      if (taskType === 'po60') return ['spo2', 'hr']
      if (taskType === 'smwt') return ['distance']
      if (taskType === 'jstyle') return ['steps', 'activeMinutes', 'exerciseMinutes', 'sleepDurationMins']
    },
    signalToString (signal, formDef) {
      if (formDef && formDef.summaryFunctionDescription && signal in formDef.summaryFunctionDescription) {
        return this.getBestLocale(formDef.summaryFunctionDescription[signal].name)
      }
      if (signal === 'steps') {
        return 'Steps'
      } else if (signal === 'activeMinutes') {
        return 'Active Minutes'
      } else if (signal === 'exerciseMinutes') {
        return 'Exercise Minutes'
      } else if (signal === 'distance') {
        return 'Distance'
      } else if (signal === 'sleepDurationMins') {
        return 'Sleep Duration'
      }
      return signal.charAt(0).toUpperCase() + signal.slice(1)
    },
    signalToDescriptionString (signal, formDef) {
      if (formDef && formDef.summaryFunctionDescription && signal in formDef.summaryFunctionDescription) {
        return this.getBestLocale(formDef.summaryFunctionDescription[signal].description)
      }
      if (signal === 'steps') {
        return 'Number of steps'
      } else if (signal === 'activeMinutes') {
        return 'Number of minutes in light activity'
      } else if (signal === 'exerciseMinutes') {
        return 'Number of minutes in exercise activity'
      } else if (signal === 'distance') {
        return 'Distance walked'
      } else if (signal === 'sleepDurationMins') {
        return 'Duration of sleep in minutes'
      }
      return ''
    },
    signalToUnitString (signal) {
      if (signal === 'steps') {
        return 'steps'
      } else if (signal === 'activeMinutes') {
        return 'minutes'
      } else if (signal === 'exerciseMinutes') {
        return 'minutes'
      } else if (signal === 'distance') {
        return 'meters'
      } else if (signal === 'sleepDurationMins') {
        return 'minutes'
      }
      return ''
    }
  }
}
</script>
