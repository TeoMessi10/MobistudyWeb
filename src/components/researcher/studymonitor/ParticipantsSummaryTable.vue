<template>
  <q-table ref="table" color="primary" flat :rows="participants" :columns="columns" binary-state-sort selection="none"
    row-key="userKey" :loading="loading" :filter="filter" v-model:pagination="pagination" @request="loadParticipants">
    <template #top-left>
      <div class="text-h6 text-center q-my-sm text-secondary text-bold text-uppercase"> Participants Summary </div>
    </template>
    <template #top-right>
      <q-select emit-value map-options outlined label="Status" :options="statusTypesOpts" v-model="filter.statusType"
        @input="updateFilter()" class="q-mr-md" style="width: 200px" />
      <q-input v-model="filter.name" type="text" placeholder="Search a participant" clearable @input="updateFilter()"
        debounce="300" style="width: 200px;">
        <template #prepend>
          <q-icon name="search" />
        </template>
      </q-input>
      <q-checkbox label="Only preferred participants" v-model="filter.preferredOnly" @input="updateFilter()" />
    </template>

    <template #body-cell-acceptedTS="props">
      <q-td :props="props">
        {{ onlyDate(props.value) }}
      </q-td>
    </template>
    <template #body-cell-lastTaskDate="props">
      <q-td :props="props">
        {{ niceTimestamp(props.value) }}
      </q-td>
    </template>
    <template #body-cell-preferred="props">
      <q-td :props="props">
        <q-checkbox checked-icon="star" unchecked-icon="star_border" indeterminate-icon="help"
          :model-value="props.value" @update:model-value="newValue => updatePreferred(props.row.userKey, newValue)" />
      </q-td>
    </template>
    <template #body-cell-data="props">
      <q-td :props="props">
        <q-btn flat icon="open_in_new" @click="openParticipantSummary(props.row)" />
      </q-td>
    </template>
  </q-table>
</template>

<script>
import API from '@shared/API.js'
import { date } from 'quasar'

export default {
  name: 'StudyParticipantsSummaryTable',
  props: [
    'studyKey',
    'taskId'
  ],
  data () {
    return {
      participants: [],
      columns: [
        { name: 'data', required: false, label: '', align: 'center', field: 'data', sortable: false },
        { name: 'FullName', required: true, label: 'Full Name', align: 'center', field: 'fullName', sortable: false, format: (value, row) => `${row.name} ${row.surname}` },
        { name: 'acceptedTS', required: true, label: 'Started', align: 'center', field: 'acceptedTS', sortable: false },
        { name: 'userEmail', required: true, label: 'Email', align: 'center', field: 'userEmail', sortable: false },
        { name: 'status', required: true, label: 'Status', align: 'center', field: 'status', sortable: false },
        { name: 'taskResultCount', required: true, label: 'Task Count', align: 'center', field: 'taskResultCount', sortable: false },
        { name: 'lastTaskDate', required: true, label: 'Last task', align: 'center', field: 'lastTaskDate', sortable: false },
        { name: 'preferred', required: true, label: 'Preferred', align: 'center', field: 'isPreferred', sortable: false }
      ],
      filter: {
        name: undefined,
        statusType: 'all',
        preferredOnly: false
      },
      pagination: {
        sortBy: 'lastTaskDate',
        descending: true,
        page: 1,
        rowsPerPage: 20,
        rowsNumber: 0
      },
      statusTypesOpts: [
        'all', 'accepted', 'withdrawn', 'completed', 'excluded', 'rejected'
      ],
      loading: false
    }
  },
  async created () {
    if (this.studyKey && this.studyKey !== -1) {
      this.loadParticipants()
    }
  },
  watch: {
    // update the table if the study key changes
    async studyKey () {
      this.loadParticipants()
    }
  },
  methods: {
    onlyDate (timeStamp) {
      return date.formatDate(timeStamp, 'YYYY-MM-DD')
    },
    niceTimestamp (timeStamp) {
      return date.formatDate(timeStamp, 'YYYY-MM-DD HH:mm:ss')
    },
    async updateFilter () {
      return this.loadParticipants()
    },
    async loadParticipants (params) {
      this.loading = true
      if (params) this.pagination = params.pagination
      try {
        // supported params for this API: studyKey, participantName, statusType, includePreferredParticipants ('none', 'both', 'only'), offset, count
        const queryParams = {
          participantName: this.filter.name,
          statusType: this.filter.statusType === 'all' ? undefined : this.filter.statusType,
          includePreferredParticipants: this.filter.preferredOnly ? 'only' : 'both',
          offset: (this.pagination.page - 1) * this.pagination.rowsPerPage,
          count: this.pagination.rowsPerPage,
          sortBy: this.pagination.sortBy,
          descending: this.pagination.descending
        }
        const stats = await API.getStudyStats(this.studyKey, queryParams)
        this.participants = stats.subset
        this.pagination.rowsNumber = stats.totalCount
      } catch (err) {
        console.error(err)
        this.$q.notify({
          color: 'negative',
          message: 'Cannot retrieve participants',
          icon: 'report_problem'
        })
      }
      this.loading = false
    },
    openParticipantSummary (row) {
      const currentUrl = this.$route.fullPath
      const userKey = row.userKey
      const urlCompleta = `${window.location.origin}/#${currentUrl}/participant/${userKey}`
      window.open(urlCompleta, '_blank')
    },
    async updatePreferred (partUserKey, newValue) {
      await API.updateResearcherPreferredParticipantInTeam(this.studyKey, partUserKey, newValue)
      return this.loadParticipants()
    }
  }
}
</script>

<style>
.q-table td {
  border-color: black;
}

.q-table th {
  border-bottom-color: black;
}

.q-table__bottom {
  border-top: 1px solid black;
}

.q-table__top {
  margin-bottom: 20px;
}
</style>
