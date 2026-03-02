<template>
  <q-dialog ref="dialog" @hide="onDialogHide" :maximized="maximizedToggle">

    <q-card style="width: 70vw;">
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
        <div class="text-h6">Completed: {{ niceTimestamp(taskResult.summary.completedTS) }}</div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <p>Total taps: {{ taskData && taskData.length }}</p>
        <p>Mean inter-tap time: {{ averageInterTapTime.toFixed(1) }} ms</p>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div style="position: relative;">
          <Scatter v-if="!loading" :data="{ datasets: tapsData }" :options="tapsOptions" ref="tapsChart" />
        </div>
      </q-card-section>

      <q-card-section class="q-pt-none">
        <div style="position: relative;">
          <Line v-if="!loading" :data="{ datasets: interTapsData }" :options="interTapsOptions" ref="interTapsChart" />
        </div>
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
  PointElement
} from 'chart.js'
import { Scatter, Line } from 'vue-chartjs'
import zoomPlugin from 'chartjs-plugin-zoom'

ChartJS.register(Title, LinearScale, PointElement, Tooltip, Legend, zoomPlugin)

export default {
  props: ['taskResult', 'taskName'],

  mixins: [bestLocale],

  components: {
    Scatter,
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
      taskData: null,
      averageInterTapTime: 0,
      tapsData: [],
      interTapsData: [],
      tapsOptions: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            beginAtZero: false,
            title: {
              display: true,
              text: 'ms',
              color: '#459399'
            }
          },
          y: {
            type: 'linear',
            beginAtZero: true,
            ticks: {
              display: false
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Taps',
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
                this.$refs.interTapsChart.chart.options.scales.x.min = xmin
                this.$refs.interTapsChart.chart.options.scales.x.max = xmax
                this.$refs.interTapsChart.chart.update()
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
                this.$refs.interTapsChart.chart.options.scales.x.min = xmin
                this.$refs.interTapsChart.chart.options.scales.x.max = xmax
                this.$refs.interTapsChart.chart.update()
              }
            }
          }
        }
      },
      interTapsOptions: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            beginAtZero: false,
            title: {
              display: true,
              text: 'ms',
              color: '#459399'
            }
          },
          y: {
            type: 'linear',
            beginAtZero: false,
            title: {
              display: true,
              text: 'ms',
              color: '#459399'
            }
          }
        },
        plugins: {
          title: {
            display: true,
            text: 'Time between taps',
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
                this.$refs.tapsChart.chart.options.scales.x.min = xmin
                this.$refs.tapsChart.chart.options.scales.x.max = xmax
                this.$refs.tapsChart.chart.update()
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
                this.$refs.tapsChart.chart.options.scales.x.min = xmin
                this.$refs.tapsChart.chart.options.scales.x.max = xmax
                this.$refs.tapsChart.chart.update()
              }
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
      const attachment = this.taskResult.attachments[0] // figner tapping should come with only one attachment

      try {
        this.loading = true

        this.taskData = await API.getTaskAttachment(studyKey, userKey, taskId, attachment)
        this.computeAverageInterTapTime()
        this.initializeCharts()

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

    computeAverageInterTapTime () {
      let avg = 0

      for (let i = 1; i < this.taskData.length; i++) {
        const delta = this.taskData[i].msFromStart - this.taskData[i - 1].msFromStart
        avg += delta
      }
      avg /= (this.taskData.length - 1)
      this.averageInterTapTime = avg
    },

    niceTimestamp (timeStamp) {
      return date.formatDate(timeStamp, 'YYYY-MM-DD HH:mm:ss')
    },

    initializeCharts () {
      const leftTaps = this.taskData.filter(tap => tap.side === 'left').map(tap => ({
        x: tap.msFromStart,
        y: 1
      }))

      const rightTaps = this.taskData.filter(tap => tap.side === 'right').map(tap => ({
        x: tap.msFromStart,
        y: 2
      }))

      const interTaps = []
      for (let i = 1; i < this.taskData.length; i++) {
        const difference = this.taskData[i].msFromStart - this.taskData[i - 1].msFromStart
        interTaps.push({ x: this.taskData[i].msFromStart, y: difference })
      }

      this.tapsData = [
        {
          label: 'Left',
          data: leftTaps,
          borderColor: '#459399',
          backgroundColor: '#459399',
          pointStyle: 'rectRot',
          radius: 4
        },
        {
          label: 'Right',
          data: rightTaps,
          borderColor: '#71bbcd',
          backgroundColor: '#71bbcd',
          pointStyle: 'rectRot',
          radius: 4
        }
      ]

      this.interTapsData = [
        {
          type: 'line',
          label: 'Time Difference',
          data: interTaps,
          borderColor: '#459399',
          backgroundColor: '#459399',
          fill: false,
          borderWidth: 1,
          pointRadius: 0
        }
      ]
    },

    resetCharts () {
      this.$refs.tapsChart.chart.resetZoom()
      this.$refs.interTapsChart.chart.resetZoom()
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
