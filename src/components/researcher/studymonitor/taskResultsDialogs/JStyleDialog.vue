<template>
  <q-dialog ref="dialog" @hide="onDialogHide" :maximized="maximizedToggle">

    <q-card>
      <q-bar class="my-q-bar bg-primary">
        <div class="text-h6 text-white text-bold text-uppercase">
          <span>{{ taskName }}</span>
        </div>
        <q-space />
        <q-btn dense flat icon="minimize" @click="maximizedToggle = false" :disable="!maximizedToggle">
          <q-tooltip v-if="maximizedToggle" class="bg-white text-primary">Minimize</q-tooltip>
        </q-btn>
        <q-btn dense flat icon="crop_square" @click="maximizedToggle = true" :disable="maximizedToggle">
          <q-tooltip v-if="!maximizedToggle" class="bg-white text-primary">Maximize</q-tooltip>
        </q-btn>
        <q-btn dense flat icon="close" v-close-popup>
          <q-tooltip class="bg-white text-primary">Close</q-tooltip>
        </q-btn>
      </q-bar>

      <q-card-section>
        <div class="text-h6">Data collected: {{ niceTimestamp(taskResult.summary.completedTS) }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div class="text-h6">Smartwatch details</div>
        <p>Name: {{ device?.name }}</p>
        <p>MAC address: {{ device?.mac }}</p>
        <p>Battery level: {{ device?.battery }}%</p>
      </q-card-section>

      <q-card-section>
        <q-table title="Activity summary" :rows="taskSummary.activitySummary" :columns="summaryTableColumns"
          row-key="date" hide-bottom />
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div style="position: relative;">
          <Line v-if="!loading" :data="timeChartData" :options="timeChartOptions" ref="timeChart"
            style="min-height: 300px;" />
        </div>
        <p style="text-align: center;">Data collected between: {{ niceTimestamp(taskSummary?.firstTS) }} and {{
          niceTimestamp(taskSummary?.lastTS)
          }}</p>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn color="secondary" @click="resetCharts()">Reset charts</q-btn>
        <q-btn color="primary" label="Done" @click="onOKClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import API from '@shared/API.js'
import { bestLocale } from '@mixins/bestLocale'
import { date } from 'quasar'

import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale
} from 'chart.js'
import { Line } from 'vue-chartjs'
import 'chartjs-adapter-luxon'
import zoomPlugin from 'chartjs-plugin-zoom'
import annotationPlugin from 'chartjs-plugin-annotation'

ChartJS.register(Title, LinearScale, PointElement, LineElement, Tooltip, Legend, TimeScale, zoomPlugin, annotationPlugin)

export default {
  props: ['taskResult', 'taskName'],

  mixins: [bestLocale],

  components: {
    // eslint-disable-next-line vue/no-reserved-component-names
    Line
  },

  emits: [
    // REQUIRED
    'ok', 'hide'
  ],

  data () {
    return {
      maximizedToggle: false,
      loading: true,
      taskSummary: null,
      summaryTableColumns: [
        {
          name: 'date',
          required: true,
          label: 'Day',
          align: 'left',
          field: row => row.date,
          format: val => new Date(val).toDateString(),
          sortable: true
        },
        {
          name: 'steps',
          required: true,
          label: 'Steps',
          align: 'right',
          field: row => row.steps,
          format: val => `${val}`,
          sortable: true
        },
        {
          name: 'calories',
          required: true,
          label: 'Calories',
          align: 'right',
          field: row => row.calories,
          format: val => `${val}`,
          sortable: true
        },
        {
          name: 'activeMinutes',
          required: true,
          label: 'Active Minutes',
          align: 'right',
          field: row => row.activeMinutes,
          format: val => `${val}`,
          sortable: true
        },
        {
          name: 'exerciseMinutes',
          required: true,
          label: 'Exercise Minutes',
          align: 'right',
          field: row => row.exerciseMinutes,
          format: val => `${val}`,
          sortable: true
        }
      ],

      device: null,
      timeChartData: {
        datasets: []
      },

      timeChartOptions: {
        responsive: true,
        maintainAspectRatio: false,
        title: {
          display: false
        },
        scales: {
          x: {
            type: 'time',
            time: {
              minUnit: 'minute',
              // Luxon format string
              tooltipFormat: 'yyyy-MM-dd HH:mm:ss'
            },
            title: {
              display: true,
              text: 'time'
            }
          },
          y: {
            title: {
              display: true,
              text: 'value'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Vital signs',
            color: '#459399',
            font: {
              size: 16
            }
          },
          legend: {
            position: 'top'
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              onPanComplete: (ch) => {
                const xmin = ch.chart.options.scales.x.min
                const xmax = ch.chart.options.scales.x.max
                this.$refs.timeChart.chart.options.scales.x.min = xmin
                this.$refs.timeChart.chart.options.scales.x.max = xmax
                this.$refs.timeChart.chart.update()
              }
            },
            zoom: {
              wheel: {
                enabled: true
              },
              pinch: {
                enabled: true
              },
              mode: 'x',
              onZoomComplete: (ch) => {
                const xmin = ch.chart.options.scales.x.min
                const xmax = ch.chart.options.scales.x.max
                this.$refs.timeChart.chart.options.scales.x.min = xmin
                this.$refs.timeChart.chart.options.scales.x.max = xmax
                this.$refs.timeChart.chart.update()
              }
            }
          },
          annotation: {
            annotations: {
              // to be added dynamically
            }
          }
        }
      }
    }
  },

  methods: {
    // following method is REQUIRED
    // (don't change its name --> "show")
    async show () {
      this.$refs.dialog.show()

      const studyKey = this.taskResult.studyKey
      const userKey = this.taskResult.userKey
      const taskId = this.taskResult.taskId
      const attachment = this.taskResult.attachments[0] // jstyle should come with only one attachment

      try {
        this.loading = true
        this.taskSummary = this.taskResult.summary
        const taskData = await API.getTaskAttachment(studyKey, userKey, taskId, attachment)
        this.device = taskData.device
        this.initializeCharts(taskData)

        this.loading = false
      } catch (err) {
        console.error(err)
        this.$emit('hide')
        this.$q.notify({
          color: 'negative',
          message: 'Cannot retrieve the task content',
          icon: 'report_problem'
        })
      }
    },

    niceTimestamp (timeStamp) {
      return date.formatDate(timeStamp, 'YYYY-MM-DD HH:mm:ss')
    },

    initializeCharts (taskData) {
      let startSleep = new Date()
      let stopSleep = new Date('1990-01-01')
      for (const sleep of taskData.sleep) {
        const date = new Date(sleep.date)
        if (date < startSleep) {
          startSleep = date
        }
        if (date > stopSleep) {
          stopSleep = date
        }
      }
      console.log('Sleep data:', { startSleep, stopSleep })
      // TODO: mark sleep periods using annotations
      // see https://www.chartjs.org/chartjs-plugin-annotation/latest/

      this.timeChartData.datasets[0] = {
        label: 'Heart rate',
        data: taskData.hr.map(item => ({
          x: new Date(item.date),
          y: item.hr
        })),
        backgroundColor: '#d60202',
        borderColor: '#d60202',
        borderWidth: 1,
        pointRadius: 1,
        lineTension: 0
      }

      this.timeChartData.datasets[1] = {
        label: 'Heart rate variability',
        data: taskData.hrv.map(item => ({
          x: new Date(item.date),
          y: item.hrv
        })),
        backgroundColor: '#9a0000',
        borderColor: '#9a0000',
        borderWidth: 1,
        pointRadius: 1,
        lineTension: 0
      }

      this.timeChartData.datasets[2] = {
        label: 'SPO2',
        data: taskData.spo2.map(item => ({
          x: new Date(item.date),
          y: item.spo2
        })),
        backgroundColor: '#00d3da',
        borderColor: '#00d3da',
        borderWidth: 1,
        pointRadius: 1,
        lineTension: 0
      }

      this.timeChartData.datasets[3] = {
        label: 'Temperature',
        data: taskData.temperature.map(item => ({
          x: new Date(item.date),
          y: item.temperature
        })),
        backgroundColor: '#8d00d9',
        borderColor: '#8d00d9',
        borderWidth: 1,
        pointRadius: 1,
        lineTension: 0
      }

      const dateToDaryString = (d) => {
        return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
      }

      const stepsData = []
      const days = []
      for (const item of taskData.activity) {
        if (item.detailSteps && item.detailSteps.length > 0) {
          const date = new Date(item.date)
          const dayString = dateToDaryString(date)
          // add the annotation if not already present
          if (!days.includes(dayString)) days.push(dayString)
          item.detailSteps.forEach((detail, idx) => {
            if (detail > 0) {
              stepsData.push({
                x: new Date(date.getTime() - (idx * 60000)),
                y: detail
              })
            }
          })
        } else {
          stepsData.push({
            x: date,
            y: item.steps / 10
          })
        }
      }

      this.timeChartData.datasets[4] = {
        label: 'Steps',
        data: stepsData,
        backgroundColor: '#050bb5',
        borderColor: '#050bb5',
        borderWidth: 0,
        pointRadius: 1,
        lineTension: 0
      }

      days.sort()
      // set a line annotation for each day
      // skip first day
      for (let i = 1; i < days.length; i++) {
        const day = days[i]
        this.timeChartOptions.plugins.annotation.annotations[`line_${day}`] = {
          type: 'line',
          xMin: new Date(day),
          xMax: new Date(day),
          borderColor: 'blue',
          borderWidth: 2,
          label: {
            content: day,
            display: true,
            position: 'center'
          }
        }
      }
    },

    resetCharts () {
      this.$refs.timeChart.chart.resetZoom()
    },

    // following method is REQUIRED
    // (don't change its name --> "hide")
    hide () {
      this.$refs.dialog.hide()
    },

    onDialogHide () {
      // required to be emitted
      // when QDialog emits "hide" event
      this.$emit('hide')
    },

    onOKClick () {
      // on OK, it is REQUIRED to
      // emit "ok" event (with optional payload)
      // before hiding the QDialog
      this.$emit('ok')
      // or with payload: this.$emit('ok', { ... })

      // then hiding dialog
      this.hide()
    },

    onCancelClick () {
      // we just need to hide the dialog
      this.hide()
    }
  }
}
</script>
