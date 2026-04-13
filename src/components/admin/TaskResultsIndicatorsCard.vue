<template>
  <!-- <q-page class="q-pa-lg"> -->
  <q-card>
    <q-form ref="emailTesterForm">
      <q-card-section>
        <div class="text-h5">Run task results indicators</div>
      </q-card-section>
      <q-card-section class="row">
        <q-select v-model="producer" :options="producers.map(p => ({ label: p.name, value: p.name }))"
          @update:model-value="onProducerSelected" label="Producer" emit-value style="min-width: 150px;"
          class="q-mr-md" />
        <q-select v-model="studyKey" label="Study key" class="q-mx-md" :options="studyOptions"
          @update:model-value="onStudySelected" emit-value style="min-width: 150px;" />
        <q-select v-model="taskId" label="Task id" class="q-mx-md" :options="taskOptions" emit-value
          style="min-width: 150px;" />
      </q-card-section>
      <q-card-actions>
        <q-btn label="Run task results indicator" color="primary" :loading="sending"
          @click="runTaskResultsIndicators" />
      </q-card-actions>
    </q-form>
  </q-card>
</template>

<script>
import API from '@shared/API'
import { bestLocale } from '@mixins/bestLocale'

export default {
  name: 'TaskResultsIndicatorsCard',
  mixins: [bestLocale],
  data () {
    return {
      producers: [],
      producer: null,
      studies: [],
      studyKey: '',
      studyOptions: [],
      taskId: ''
    }
  },
  async mounted () {
    this.producers = await API.getTaskResultsIndicatorsProducers()
  },
  methods: {
    async onProducerSelected () {
      this.studies = await API.getStudiesWithTaskResultsIndicatorsProducer(this.producer)
      console.log('Studies with producer ' + this.producer, this.studies)
      this.studyOptions = this.studies.map(s => ({ label: this.getBestLocale(s.title), value: s._key }))
    },
    async onStudySelected () {
      this.taskOptions = this.studies.find(s => s._key === this.studyKey).tasks.map(t => ({ label: t.type, value: t.id }))
    },
    async runTaskResultsIndicators () {
      if (!this.producer || !this.studyKey || !this.taskId) {
        this.$q.notify({ type: 'negative', message: 'Please select a producer, a study and a task' })
        return
      }
      try {
        console.log('Running task results indicators producer ' + this.producer + ' for study ' + this.studyKey + ' and task ', this.taskId)
        await API.runTaskResultsIndicatorsProducer(this.producer, this.studyKey, this.taskId)
        this.$q.notify({ type: 'positive', message: 'Task results indicators have been computed' })
      } catch (err) {
        console.error(err)
        this.$q.notify({ type: 'negative', message: 'An error occurred while running task results indicators' })
      }
    }
  }
}
</script>
