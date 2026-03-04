import { auth } from '@/auth'
import { isAdminEmail } from '@/lib/auth/admin-emails'
import { PlaygroundClient } from './PlaygroundClient'

export default async function EuclidPlaygroundPage() {
  const session = await auth()
  const isAdmin = isAdminEmail(session?.user?.email)

  return <PlaygroundClient isAdmin={isAdmin} />
}
