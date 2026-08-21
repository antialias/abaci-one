import { getPracticePickerV1Data } from '@/lib/practice-picker/server'
import { getUserId } from '@/lib/viewer'
import { PracticeClient } from './PracticeClient'

/**
 * Practice page - Server Component
 *
 * Fetches player list on the server and passes to client component.
 * This provides instant rendering with no loading spinner.
 *
 * URL: /practice
 */
export default async function PracticePage() {
  // Fetch the bounded picker contract directly on server - no HTTP round-trip
  const pickerData = await getPracticePickerV1Data()

  // Get database user ID for parent socket notifications and session observation
  const userId = await getUserId()

  return <PracticeClient initialPickerData={pickerData} viewerId={userId} userId={userId} />
}
