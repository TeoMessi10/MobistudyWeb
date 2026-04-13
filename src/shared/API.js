import axios from 'axios'

const BASE_URL = 'api'
let axiosConfig = {}

export default {
  setToken (newtoken) {
    axiosConfig = {
      headers: {
        Authorization: 'Bearer ' + newtoken,
        accept: 'audio/*'
      }
    }
  },
  /**
   * User login
   * @param {string} email - The user's email address
   * @param {string} password - The user's password
   * @returns {Promise<Object>} - The login response containing the user data
   */
  async login (email, password) {
    const resp = await axios.post(BASE_URL + '/login', { email, password })
    return resp.data
  },
  /**
   * Request a password reset email
   * @param {string} email - The user's email address
   * @returns {Promise} - A promise that resolves when the email is sent
   */
  async askPasswordResetEmail (email) {
    return axios.post(BASE_URL + '/sendResetPasswordEmail', { email })
  },
  /**
   * Reset the user's password
   * @param {string} token - The password reset token
   * @param {string} newpassword - The new password
   * @returns {Promise} - A promise that resolves when the password is reset
   */
  async resetPassword (token, newpassword) {
    return axios.post(BASE_URL + '/resetPassword', { token, password: newpassword })
  },
  /**
   * Create a new user
   * @param {Object} newuser - The user data
   * @returns {Promise<Object>} - The created user data
   */
  async createUser (newuser) {
    return axios.post(BASE_URL + '/users', newuser)
  },
  /**
   * Search for a disease concept
   * @param {string} disease - The disease search string
   * @param {string} lang - The language code
   * @returns {Promise<Object>} - The search results
   */
  async searchDiseaseConcept (disease, lang) {
    return axios.get(BASE_URL + '/vocabulary/' + lang + '/disorder/search?term=' + disease + '&limit=10')
  },
  /**
   * Search for a medication concept
   * @param {string} med - The medication search string
   * @param {string} lang - The language code
   * @returns {Promise<Object>} - The search results
   */
  async searchMedicationConcept (med, lang) {
    return axios.get(BASE_URL + '/vocabulary/' + lang + '/substance/search?term=' + med + '&limit=10')
  },

  /// ////////////////////////////////////
  // from here on, we need to use tokens
  /// ////////////////////////////////////
  /**
   * Create a new team
   * @param {string} teamName - The name of the team
   * @returns {Promise<Object>} - The created team data
   */
  async createTeam (teamName) {
    return axios.post(BASE_URL + '/teams', {
      name: teamName
    }, axiosConfig)
  },
  /**
   * Get all teams
   * @returns {Promise<Array<Object>>} - The list of teams
   */
  async getTeams () {
    const resp = await axios.get(BASE_URL + '/teams', axiosConfig)
    return resp.data
  },
  /**
   * Generate a unique invitation code for a team
   * @param {string} teamKey - The unique identifier for the team
   * @returns {Promise<string>} - The generated invitation code
   */
  async generateTeamCode (teamKey) {
    const resp = await axios.get(BASE_URL + '/teams/invitationCode/' + teamKey, axiosConfig)
    return resp.data
  },
  /**
   * Add a user to a team
   * @param {string} invitationCode - The invitation code for the team
   * @returns {Promise} - A promise
   */
  async addUserToTeam (invitationCode) {
    return axios.post(BASE_URL + '/teams/researchers/add', { invitationCode }, axiosConfig)
  },
  /**
   * Remove a user from a team
   * @param {string} userRemoved - The user to remove from the team
   * @returns {Promise} - A promise
   */
  async removeUserFromTeam (userRemoved) {
    return axios.post(BASE_URL + '/teams/researchers/remove', { userRemoved }, axiosConfig)
  },
  /**
   * Delete a team
   * @param {string} teamKey - The unique identifier for the team
   * @returns {Promise} - A promise
   */
  async deleteTeam (teamKey) {
    const resp = await axios.delete(BASE_URL + '/teams/' + teamKey, axiosConfig)
    return resp.data
  },
  // USER
  // NEW GET ROLE TYPES FUNCTION
  async getRoleTypes () {
    const resp = await axios.get(BASE_URL + '/users/roleTypes', axiosConfig)
    return resp.data
  },
  async getUserByKey (userKey) {
    const resp = await axios.get(BASE_URL + '/users/' + userKey, axiosConfig)
    return resp.data
  },
  // NEW GET USERS FUNCTION
  async getAllUsers (filter) {
    let queryParams = ''
    let firstParam = true
    for (const param in filter) {
      if (filter[param] || filter[param] === 0) {
        queryParams += (firstParam ? '' : '&') + param + '=' + encodeURIComponent(filter[param])
        firstParam = false
      }
    }
    const URL = BASE_URL + '/users' + (firstParam ? '' : '?') + queryParams
    const resp = await axios.get(URL, axiosConfig)
    return resp.data
  },
  async updateUser (userKey, user) {
    return axios.patch(BASE_URL + '/users/' + userKey, user, axiosConfig)
  },
  async deleteUser (userKey) {
    const resp = await axios.delete(BASE_URL + '/users/' + userKey, axiosConfig)
    return resp.data
  },
  // STUDY
  /**
   * Create a new study
   * @param {Object} design - The design of the study
   * @returns {Promise<Object>} - The created study data
   */
  async createStudy (design) {
    return axios.post(BASE_URL + '/studies', design, axiosConfig)
  },
  async updateStudy (studyKey, design) {
    return axios.put(BASE_URL + '/studies/' + studyKey, design, axiosConfig)
  },
  async updateResearcherStudyOptionInTeam (teamKey, studyKey) {
    // query params: teamKey and studyKey, body: studiesOptions for that study
    const resp = await axios.patch(BASE_URL + '/teams/' + teamKey + '/researchers/studiesOptions/' + studyKey, axiosConfig)
    return resp.data
  },
  async updateResearcherPreferredParticipantInTeam (studyKey, participantUserKey, isPreferred) {
    // query params: teamKey, studyKey and participantUserKey, body: { isPreferred: true / false }
    return axios.patch(BASE_URL + '/teams/researchers/studiesOptions/' + studyKey + '/preferredParticipantsKey/' + participantUserKey, { isPreferred }, axiosConfig)
  },
  async getStudy (studyKey) {
    const resp = await axios.get(BASE_URL + '/studies/' + studyKey, axiosConfig)
    return resp.data
  },
  // STUDY STATS
  async getParticipantsStatusStats (studyKey) {
    const resp = await axios.get(BASE_URL + '/studyStats/' + studyKey + '/participantsStatusStats', axiosConfig)
    return resp.data
  },
  async getStudyStats (studyKey, filter) {
    let queryParams = ''
    let hasParams = false
    for (const param in filter) {
      // supported params for this API: studyKey, participantName, statusType
      if (filter[param] || filter[param] === 0) {
        queryParams += (!hasParams ? '' : '&') + param + '=' + encodeURIComponent(filter[param])
        hasParams = true
      }
    }
    const URL = BASE_URL + '/studyStats/' + studyKey + '/lastTasksSummary' + (hasParams ? '?' : '') + queryParams
    const resp = await axios.get(URL, axiosConfig)
    return resp.data
  },
  // NEW GET STUDIES FUNCTION FOR TableStudies.vue
  async getAllStudies (filter) {
    let queryParams = ''
    let firstParam = true
    for (const param in filter) {
      if (filter[param] || filter[param] === 0) {
        queryParams += (firstParam ? '' : '&') + param + '=' + encodeURIComponent(filter[param])
        firstParam = false
      }
    }
    const URL = BASE_URL + '/studies' + (firstParam ? '' : '?') + queryParams
    const resp = await axios.get(URL, axiosConfig)
    return resp.data
  },
  async getAllTeamStudies (teamKey) {
    const resp = await axios.get(BASE_URL + '/studies?teamKey=' + teamKey, axiosConfig)
    return resp.data
  },
  async deleteStudy (studyKey) {
    const resp = await axios.delete(BASE_URL + '/studies/' + studyKey, axiosConfig)
    return resp.data
  },
  async getInvitationCode () {
    const resp = await axios.get(BASE_URL + '/studies/newInvitationCode', axiosConfig)
    return resp.data
  },
  // FORMS
  async getForm (formKey) {
    const resp = await axios.get(BASE_URL + '/forms/' + formKey, axiosConfig)
    return resp.data
  },
  async getFormsList () {
    const resp = await axios.get(BASE_URL + '/forms?list=true', axiosConfig)
    return resp.data
  },
  async publishForm (form) {
    return axios.post(BASE_URL + '/forms', form, axiosConfig)
  },
  // PARTICIPANT
  async getOneParticipant (userKey) {
    const resp = await axios.get(BASE_URL + '/participants/byuserkey/' + userKey, axiosConfig)
    return resp.data
  },
  async getParticipants () {
    const resp = await axios.get(BASE_URL + '/participants', axiosConfig)
    return resp.data
  },
  async getParticipantsOfStudy (studyKey, currentStatus) {
    let resp
    if (currentStatus) {
      resp = await axios.get(BASE_URL + '/participants?studyKey=' + studyKey + '&currentStatus=' + currentStatus, axiosConfig)
    } else {
      resp = await axios.get(BASE_URL + '/participants?studyKey=' + studyKey, axiosConfig)
    }
    return resp.data
  },
  async deleteParticipant (participantKey) {
    const resp = await axios.delete(BASE_URL + '/participants/' + participantKey, axiosConfig)
    return resp.data
  },
  // Answers
  async getAnswersOfStudy (studyKey) {
    const resp = await axios.get(BASE_URL + '/answers?studyKey=' + studyKey, axiosConfig)
    return resp.data
  },
  // Tasks Results
  async getTasksResults (studyKey, participantUserKey, taskIds, offset, count) {
    const queryParams = {
      studyKey,
      participantUserKey,
      taskIds,
      offset,
      count
    }
    let newOpts = {
      params: queryParams
    }
    newOpts = Object.assign(newOpts, axiosConfig)
    const resp = await axios.get(BASE_URL + '/tasksResults', newOpts)
    return resp.data
  },
  // Task Results Indicators
  async getTaskResultsIndicators (studyKey, userKey, taskIds, producer, offset, count) {
    // must include param: studyKey, userKey, optional as query: taskIds (comma separated), producer, offset, count
    // :studyKey/:userKey/
    const queryParams = {
      taskIds,
      producer,
      offset,
      count
    }
    const newOpts = { ...axiosConfig, ...{ params: queryParams } }
    console.log('Fetching task results indicators with options:', newOpts)
    const resp = await axios.get(BASE_URL + `/taskResultsIndicators/${studyKey}/${userKey}`, newOpts)
    return resp.data
  },
  async getTaskAttachment (studyKey, userKey, taskId, fileName) {
    // :studyKey/:userKey/:taskId/:fileName
    const URL = BASE_URL + `/tasksResults/attachments/${studyKey}/${userKey}/${taskId}/${fileName}`
    const resp = await axios.get(URL, axiosConfig)
    return resp.data
  },
  async getAudioAttachment (studyKey, userKey, taskId, fileName) {
    const URL = BASE_URL + `/tasksResults/attachments/${studyKey}/${userKey}/${taskId}/${fileName}`
    const resp = await axios.get(URL, { ...axiosConfig, responseType: 'blob' })
    return resp.data
  },
  // Health Store Data
  async getHealthStoreDataOfStudy (studyKey) {
    const resp = await axios.get(BASE_URL + '/healthStoreData?studyKey=' + studyKey, axiosConfig)
    return resp.data
  },
  // Audit LOG
  /**
   * Get the list of log event types
   * @returns {Promise<Array>} - A promise that resolves to the list of log event types
   */
  async getLogEventTypes () {
    const resp = await axios.get(BASE_URL + '/auditlog/eventTypes', axiosConfig)
    return resp.data
  },
  /**
   * Get the logs based on the provided filter
   * @param {Object} filter - The filter criteria for fetching logs
   * @returns {Promise<Array>} - A promise that resolves to the list of logs
   */
  async getLogs (filter) {
    let queryParams = ''
    let hasParams = false
    for (const param in filter) {
      // supported params for this API: studyKey, participantName, statusType
      if (filter[param] || filter[param] === 0) {
        queryParams += (!hasParams ? '' : '&') + param + '=' + encodeURIComponent(filter[param])
        hasParams = true
      }
    }
    const URL = BASE_URL + '/auditlog' + (hasParams ? '?' : '') + queryParams
    const resp = await axios.get(URL, axiosConfig)
    /* EXAMPLE RESPONSE DATA
      obj: Object
      _key: "105794"
      data: Null
      event: "userCreated"
      message: "New user created with email forreal@gmail.com"
      refData: "users"
      refKey: "105792"
      timestamp: "2020-11-19T16:31:03.623Z"
      email: "forreal@gmail.com"
    */
    return resp.data
  },
  async downloadStudyData (studyKey) {
    const resp = await axios.post(BASE_URL + '/studydatacreate/' + studyKey, {}, axiosConfig)
    return resp.data
  },
  // Test stuff
  async sendTestEmail (email, subject, content) {
    return axios.post(BASE_URL + '/techadmin/sendemail/', { address: email, subject, content }, axiosConfig)
  },
  async getTaskResultsIndicatorsProducers () {
    const resp = await axios.get(BASE_URL + '/taskResultsIndicators/producers', axiosConfig)
    return resp.data
  },
  async getStudiesWithTaskResultsIndicatorsProducer (producer) {
    const resp = await axios.get(BASE_URL + '/taskResultsIndicators/studiesWithProducer/' + producer, axiosConfig)
    return resp.data
  },
  async runTaskResultsIndicatorsProducer (producer, studyKey, taskId) {
    const resp = await axios.post(BASE_URL + '/taskResultsIndicators/runProducer/' + producer + '/' + studyKey + '/' + taskId, null, axiosConfig)
    return resp.data
  }
}
