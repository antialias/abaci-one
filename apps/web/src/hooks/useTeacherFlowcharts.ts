'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/queryClient'
import { flowchartKeys } from '@/lib/queryKeys'

export interface TeacherFlowchart {
  id: string
  title: string
  description: string | null
  emoji: string
  difficulty: string | null
  status: 'draft' | 'published' | 'archived'
  version: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

async function fetchMyFlowcharts(): Promise<TeacherFlowchart[]> {
  const res = await api('teacher-flowcharts')
  if (!res.ok) throw new Error('Failed to fetch flowcharts')
  const data = await res.json()
  return data.flowcharts ?? []
}

export function useMyFlowcharts() {
  return useQuery({
    queryKey: flowchartKeys.mine(),
    queryFn: fetchMyFlowcharts,
  })
}

export function usePublishFlowchart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api(`teacher-flowcharts/${id}/publish`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to publish')
      const data = await res.json()
      return data.flowchart as TeacherFlowchart
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<TeacherFlowchart[]>(
        flowchartKeys.mine(),
        (prev) => prev?.map((f) => (f.id === updated.id ? updated : f)) ?? []
      )
    },
  })
}

export function useUnpublishFlowchart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api(`teacher-flowcharts/${id}/unpublish`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to unpublish')
      const data = await res.json()
      return data.flowchart as TeacherFlowchart
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<TeacherFlowchart[]>(
        flowchartKeys.mine(),
        (prev) => prev?.map((f) => (f.id === updated.id ? updated : f)) ?? []
      )
    },
  })
}

export function useDeleteFlowchart() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api(`teacher-flowcharts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to archive')
      return id
    },
    onSuccess: (id) => {
      queryClient.setQueryData<TeacherFlowchart[]>(
        flowchartKeys.mine(),
        (prev) => prev?.filter((f) => f.id !== id) ?? []
      )
    },
  })
}

export function useEditFlowchart() {
  const router = useRouter()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api('flowchart-workshop/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowchartId: id }),
      })
      if (!res.ok) throw new Error('Failed to create edit session')
      const data = await res.json()
      return data.session.id as string
    },
    onSuccess: (sessionId) => {
      router.push(`/flowchart/workshop/${sessionId}`)
    },
  })
}
