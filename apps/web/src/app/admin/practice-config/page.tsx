import { PracticeConfigClient } from './PracticeConfigClient'

/**
 * Admin page for configuring term count scaling.
 *
 * Controls how many terms per problem a student gets at each comfort level,
 * independently per mode (abacus, visualization, linear).
 */
export default function PracticeConfigPage() {
  return <PracticeConfigClient />
}
