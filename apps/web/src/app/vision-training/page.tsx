import { redirect } from 'next/navigation'

/**
 * Vision Training Root Page
 *
 * Redirects to the default model type (boundary-detector).
 * The actual pages are under /vision-training/[model]/...
 */
export default function VisionTrainingPage() {
  redirect('/vision-training/boundary-detector')
}
