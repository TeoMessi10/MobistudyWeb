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
        <p class="taskVisualizationHeader">Completed: {{ niceTimestamp(taskResult.summary.completedTS) }}</p>
        <div class="figureContainer">
          <div class="figureContainerWrapper">
            <p>Square</p>
            <canvas class="drawingCanvas" ref="squareCanvas"></canvas>
          </div>
          <div class="figureContainerWrapper">
            <p>Spiral</p>
            <canvas class="drawingCanvas" ref="spiralCanvas"></canvas>
          </div>
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn color="primary" label="Done" @click="onOKClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { date } from 'quasar'
import API from '@shared/API.js'
import { bestLocale } from '@mixins/bestLocale'

export default {
  props: ['taskResult', 'taskName'],

  mixins: [bestLocale],

  emits: [
    // REQUIRED
    'ok', 'hide'
  ],

  data () {
    return {
      maximizedToggle: false,
      taskData: null
    }
  },

  methods: {
    // following method is REQUIRED
    // (don't change its name --> "show")
    async show () {
      this.$refs.dialog.show()

      try {
        const studyKey = this.taskResult.studyKey
        const userKey = this.taskResult.userKey
        const taskId = this.taskResult.taskId
        const attachment = this.taskResult.attachments[0] // forms should come with only one attachment

        this.taskData = await API.getTaskAttachment(studyKey, userKey, taskId, attachment)

        this.drawSquare()
        this.drawSpiral()
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

    drawSquare () {
      const canvas = this.$refs.squareCanvas
      const ctx = canvas.getContext('2d')
      const originalSquare = [
        { x: 300, y: 200 }, { x: 300, y: 50 }, { x: 50, y: 50 },
        { x: 50, y: 300 }, { x: 300, y: 300 }, { x: 300, y: 200 }
      ]
      canvas.width = 350
      canvas.height = 350
      ctx.beginPath()
      ctx.moveTo(originalSquare[0].x, originalSquare[0].y)
      ctx.strokeStyle = 'black'
      ctx.lineWidth = 2
      for (const point of originalSquare) {
        ctx.lineTo(point.x, point.y)
      }
      ctx.closePath()
      ctx.stroke()
      const userSquareCoordinates = this.taskData.square.touchCoordinates
      ctx.beginPath()
      ctx.moveTo(userSquareCoordinates[0].x, userSquareCoordinates[0].y)
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 2
      for (const point of userSquareCoordinates) {
        ctx.lineTo(point.x, point.y)
      }
      ctx.stroke()
    },
    drawSpiral () {
      const canvas = this.$refs.spiralCanvas
      const ctx = canvas.getContext('2d')
      const originalSpiral = [
        { x: 300, y: 200 }, { x: 300, y: 50 }, { x: 50, y: 50 }, { x: 50, y: 300 }, { x: 250, y: 300 }, { x: 250, y: 100 },
        { x: 100, y: 100 }, { x: 100, y: 250 }, { x: 200, y: 250 }, { x: 200, y: 150 }, { x: 150, y: 150 }, { x: 150, y: 200 }
      ]
      canvas.width = 350
      canvas.height = 350
      ctx.beginPath()
      ctx.moveTo(originalSpiral[0].x, originalSpiral[0].y)
      ctx.strokeStyle = 'black'
      ctx.lineWidth = 2
      for (const point of originalSpiral) {
        ctx.lineTo(point.x, point.y)
      }
      ctx.stroke()

      const userSpiralCoordinates = this.taskData.spiral.touchCoordinates
      ctx.beginPath()
      ctx.moveTo(userSpiralCoordinates[0].x, userSpiralCoordinates[0].y)
      ctx.strokeStyle = 'red'
      ctx.lineWidth = 2
      for (const point of userSpiralCoordinates) {
        ctx.lineTo(point.x, point.y)
      }
      ctx.stroke()
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

<style>
.container {
  display: flex;
  flex-wrap: wrap;
}

.taskVisualizationHeader {
  width: 100%;
  text-align: center;
  font-weight: bold;
  color: #459399;
}

.figureContainer {
  width: 100%;
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.drawingCanvas {
  width: 100%;
  height: 100%;
}

.figureContainer p {
  text-align: center;
  font-size: 16px;
  font-weight: bold;
  color: #459399;
}
</style>
