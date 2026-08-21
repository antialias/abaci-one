import { getPlayersWithSkillData } from '@/lib/curriculum/server'
import { metrics } from '@/lib/metrics'
import {
  createPracticePickerV1Response,
  type PracticePickerV1Response,
} from './contract'

/**
 * Load the versioned practice-picker contract for an authorized viewer.
 * Authorization and guest-link expiry are inherited from the canonical
 * parented-player listing inside getPlayersWithSkillData().
 */
export async function getPracticePickerV1Data(): Promise<PracticePickerV1Response> {
  const students = await getPlayersWithSkillData({ measurePayload: false })
  const response = createPracticePickerV1Response(students)

  // Measure the actual bounded object that crosses both the RSC and API boundaries.
  try {
    const payloadBytes = new TextEncoder().encode(JSON.stringify(response)).byteLength
    metrics.practicePicker.payloadSize.observe({ outcome: 'complete' }, payloadBytes)
  } catch (error) {
    console.error('[Practice] Failed to measure picker v1 payload size', error)
  }

  return response
}
