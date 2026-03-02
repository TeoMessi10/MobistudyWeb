/**
 * Converts a task type to a readable name (in English)
 **/
export function taskTypeToString (taskType) {
  if (taskType === 'form') {
    return 'Form'
  } else if (taskType === 'fingerTapping') {
    return 'Finger Tapping'
  } else if (taskType === 'holdPhone') {
    return 'Hold The Phone'
  } else if (taskType === 'tugt') {
    return 'Timed Up and Go Test'
  } else if (taskType === 'peakFlow') {
    return 'Peak Flow'
  } else if (taskType === 'miband') {
    return 'Mi-Band wearable'
  } else if (taskType === 'smwt') {
    return 'Six Minute Walk Test'
  } else if (taskType === 'position') {
    return 'Position and environment'
  } else if (taskType === 'qcst') {
    return 'Queen\'s College Step Test'
  } else if (taskType === 'po60') {
    return 'Pulseoxmetry'
  }
  return taskType.charAt(0).toUpperCase() + taskType.slice(1)
}
