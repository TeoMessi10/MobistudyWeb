<template>
  <q-page>
    <q-tabs v-model="tab" class="bg-secondary text-grey-5 shadow-2" switch-indicator active-color="white"
      align="justify">
      <q-tab name="tab-logs" icon="format_align_justify" label="Logs" />
      <q-tab name="tab-users" icon="person" label="Users" />
      <q-tab name="tab-teams" icon="group" label="Teams" />
      <q-tab name="tab-studies" icon="local_library" label="Studies" />
      <q-tab name="tab-indicators" icon="manage_history" label="Indicators" />

      <q-tab name="tab-tester" icon="verified_user" label="Tests" />
    </q-tabs>
    <q-tab-panels v-model="tab">
      <q-tab-panel name="tab-logs">
        <audit-log-table />
      </q-tab-panel>

      <q-tab-panel name="tab-teams">
        <new-team-card @newTeam="refreshTeams()" />
        <teams-invitations-card ref="invitations" @teamDeleted="refreshStudies()" class="q-mt-md" />
      </q-tab-panel>

      <q-tab-panel name="tab-studies">
        <studies-table />
      </q-tab-panel>

      <q-tab-panel name="tab-users">
        <users-table />
      </q-tab-panel>

      <q-tab-panel name="tab-indicators">
        <task-results-indicators-card />
      </q-tab-panel>

      <q-tab-panel name="tab-tester">
        <h4>Admin and test tools</h4>
        <email-tester-card />
      </q-tab-panel>
    </q-tab-panels>
  </q-page>
</template>
<style>
div .exactFit {
  word-wrap: break-word;
}
</style>

<script>
import AuditLogTable from '@components/AuditLogTable'
import NewTeamCard from '@components/admin/NewTeamCard'
import TeamsInvitationsCard from '@components/admin/TeamsInvitationsCard'
import EmailTesterCard from '@components/admin/EmailTesterCard'
import UsersTable from '@components/admin/UsersTable.vue'
import StudiesTable from '@components/admin/StudiesTable.vue'
import TaskResultsIndicatorsCard from '@components/admin/TaskResultsIndicatorsCard.vue'

export default {
  name: 'AdminHomePage',
  components: {
    AuditLogTable,
    NewTeamCard,
    TeamsInvitationsCard,
    EmailTesterCard,
    UsersTable,
    StudiesTable,
    TaskResultsIndicatorsCard
  },
  data () {
    return {
      tab: 'tab-logs'
    }
  },
  methods: {
    async refreshTeams () {
      if (this.$refs.invitations) this.$refs.invitations.getTeams()
    },
    async refreshStudies () {
      if (this.$refs.studies) this.$refs.studies.geStudies()
    }
  }
}
</script>
