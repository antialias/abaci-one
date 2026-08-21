'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import type { PracticePickerV1Data } from '@/lib/practice-picker/contract'
import {
  normalizePracticePickerV1Response,
  type PracticePickerNotesV1Response,
  type PracticePickerV1Response,
} from '@/lib/practice-picker/contract'
import { api } from '@/lib/queryClient'
import { playerKeys, practicePickerKeys } from '@/lib/queryKeys'

async function fetchPracticePickerV1(): Promise<PracticePickerV1Response> {
  const response = await api('practice-picker/v1/students')
  if (!response.ok) throw new Error('Failed to fetch practice students')
  return response.json()
}

async function fetchPracticePickerNotes(playerId: string): Promise<PracticePickerNotesV1Response> {
  const response = await api(`practice-picker/v1/students/${playerId}/notes`)
  if (!response.ok) throw new Error('Failed to fetch student notes')
  return response.json()
}

/**
 * Fetch the bounded v1 picker contract and hydrate the existing per-student
 * classroom caches before action-menu children mount.
 */
export function usePracticePickerV1(options?: { initialData?: PracticePickerV1Response }) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: practicePickerKeys.v1(),
    queryFn: fetchPracticePickerV1,
    initialData: options?.initialData,
    select: normalizePracticePickerV1Response,
    staleTime: 30_000,
  })

  const lastSeededDataRef = useRef<PracticePickerV1Data | undefined>()
  if (query.data && query.data !== lastSeededDataRef.current) {
    lastSeededDataRef.current = query.data
    for (const student of query.data.students) {
      queryClient.setQueryData(
        playerKeys.enrolledClassrooms(student.id),
        student.enrolledClassrooms ?? []
      )
      queryClient.setQueryData(playerKeys.presence(student.id), student.currentPresence ?? null)
    }
  }

  return query
}

/** Fetch private notes only when Quick Look explicitly requests them. */
export function usePracticePickerNotes(playerId: string, enabled: boolean) {
  return useQuery({
    queryKey: practicePickerKeys.notes(playerId),
    queryFn: () => fetchPracticePickerNotes(playerId),
    enabled,
    staleTime: 30_000,
  })
}
