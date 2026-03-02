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
        <div v-for="(answer, index) in answers" :key="index">
          <p class="q-title text-bold">
            {{ getBestLocale(answer.questionText) }}
          </p>
          <p v-if="answer.questionType == 'freetext'">
            {{ answer.answer }}
          </p>
          <p v-if="answer.questionType == 'slider'">
            {{ answer.answer }}
          </p>
          <p v-if="answer.questionType == 'number'">
            {{ answer.answer }}
          </p>
          <p v-if="answer.questionType == 'time'">
            {{ answer.answer }}
          </p>
          <p v-if="answer.questionType == 'singleChoice'">
            {{ getBestLocale(answer.answer.answerText) }}
          </p>
          <div v-if="answer.questionType == 'multiChoice'">
            <p v-for="(subanswer, index1) in answer.answer" :key="index1">
              {{ getBestLocale(subanswer.answerText) }}
            </p>
          </div>
          <!-- <q-img v-if="answer.questionType === 'photo' && answer.answer" :src="answer.answer" @click="showImage" />
          <q-img v-if="answer.questionType === 'photo' && !answer.answer" :src="photoUrl" />
          <div v-show="isImageVisible" class="fullscreen-image">
            <span class="close-btn" @click="hideImage">&times;</span>
            <img :src="answer.answer" alt="Full screen Image" />
          </div> -->
        </div>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn color="primary" label="Done" @click="onOKClick" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
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
      answers: []
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

        this.answers = await API.getTaskAttachment(studyKey, userKey, taskId, attachment)
      } catch (err) {
        this.$emit('hide')
        this.$q.notify({
          color: 'negative',
          message: 'Cannot retrieve the task content',
          icon: 'report_problem'
        })
      }
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
