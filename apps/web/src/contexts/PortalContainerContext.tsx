'use client'

import { createContext, type ReactNode, useContext } from 'react'

/**
 * Supplies a DOM node that descendant Radix `*.Portal`s should render into,
 * instead of the default `document.body`.
 *
 * Why this exists: a popover/dropdown rendered via `Portal` to `document.body`
 * becomes a *sibling* of any open modal. It then has to out-number the modal's
 * z-index to be visible — and the modal marks body-level siblings inert, so it
 * may not even be clickable. Rendering the portal *inside* the modal's subtree
 * instead puts it in the modal's own stacking context (no z-index war) and
 * inside the Dialog focus tree (interactive).
 *
 * Default is `null` → consumers pass `undefined` to `Portal`, i.e. the normal
 * `document.body` behavior. Only wrap content that lives inside a modal.
 */
const PortalContainerContext = createContext<HTMLElement | null>(null)

export function PortalContainerProvider({
  container,
  children,
}: {
  container: HTMLElement | null
  children: ReactNode
}) {
  return (
    <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>
  )
}

/** Returns the portal container, or `null` when not inside a provider. */
export function usePortalContainer(): HTMLElement | null {
  return useContext(PortalContainerContext)
}
