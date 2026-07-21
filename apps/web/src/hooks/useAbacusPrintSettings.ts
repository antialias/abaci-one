'use client'

import type { TicketStyle } from '@eink/print-dialog'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'
import { abacusPrintKeys } from '@/lib/queryKeys'

interface PrintSettingsResponse {
  style: TicketStyle | null
}

async function fetchPrintSettings(): Promise<TicketStyle | null> {
  const res = await api('abacus/print/settings')
  if (!res.ok) throw new Error('Failed to fetch print settings')
  const data: PrintSettingsResponse = await res.json()
  return data.style
}

async function savePrintSettings(style: TicketStyle): Promise<TicketStyle | null> {
  const res = await api('abacus/print/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ style }),
  })
  if (!res.ok) throw new Error('Failed to save print settings')
  const data: PrintSettingsResponse = await res.json()
  return data.style
}

/**
 * Hook: the caller's saved print-settings overlay (TicketStyle), null when
 * they've never tuned one — the dialog then seeds from the printer's
 * capability doc as before.
 */
export function useAbacusPrintSettings(enabled = true) {
  return useQuery({
    queryKey: abacusPrintKeys.settings(),
    queryFn: fetchPrintSettings,
    enabled,
    // Changes only via the viewer's own saves (which set the cache directly)
    staleTime: 1000 * 60 * 30,
  })
}

/** Hook: save the print-settings overlay with optimistic update */
export function useSaveAbacusPrintSettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: savePrintSettings,
    onMutate: async (style) => {
      await queryClient.cancelQueries({ queryKey: abacusPrintKeys.settings() })

      const previous = queryClient.getQueryData<TicketStyle | null>(abacusPrintKeys.settings())

      queryClient.setQueryData(abacusPrintKeys.settings(), style)

      return { previous }
    },
    onError: (_err, _style, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(abacusPrintKeys.settings(), context.previous)
      }
    },
    onSettled: (savedStyle) => {
      if (savedStyle) {
        queryClient.setQueryData(abacusPrintKeys.settings(), savedStyle)
      }
    },
  })
}
