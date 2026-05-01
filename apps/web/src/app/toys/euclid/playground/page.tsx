import { auth } from '@/auth'
import { isUserAdmin } from '@/lib/auth/roles'
import { PlaygroundClient } from './PlaygroundClient'

export default async function EuclidPlaygroundPage() {
  const session = await auth()
  const isAdmin = await isUserAdmin({
    userId: session?.user?.id,
    email: session?.user?.email,
  })

  return <PlaygroundClient isAdmin={isAdmin} />
}
