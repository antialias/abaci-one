/**
 * Accessibility tests for Dialog-based modals.
 *
 * These tests use axe-core to check that modals meet WCAG requirements.
 * The key rule is `aria-dialog-name`: every role="dialog" element must have
 * an accessible name (via Dialog.Title, aria-label, or aria-labelledby).
 *
 * This catches the Radix UI warning:
 *   "`DialogContent` requires a `DialogTitle` for the component to be
 *   accessible for screen reader users."
 *
 * NOTE: Radix Dialog portals content to document.body, so we must run
 * axe on document.body rather than the render container.
 *
 * To add coverage for a new modal:
 *   1. Import the component
 *   2. Render it in its open state with minimal required props
 *   3. Assert `expect(await axe(document.body)).toHaveNoViolations()`
 */
import * as Dialog from '@radix-ui/react-dialog'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { axe } from 'vitest-axe'

describe('Dialog accessibility', () => {
  afterEach(() => {
    cleanup()
  })

  it('detects missing Dialog.Title (canary test)', async () => {
    render(
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Content aria-describedby={undefined}>
            <p>Content without a title</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )

    const results = await axe(document.body)
    const dialogNameViolation = results.violations.find((v) => v.id === 'aria-dialog-name')
    expect(dialogNameViolation).toBeDefined()
  })

  it('passes when Dialog.Title is present', async () => {
    render(
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Content aria-describedby={undefined}>
            <Dialog.Title>My Modal</Dialog.Title>
            <p>Content with a title</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )

    const results = await axe(document.body)
    const dialogNameViolation = results.violations.find((v) => v.id === 'aria-dialog-name')
    expect(dialogNameViolation).toBeUndefined()
  })

  it('passes when aria-label is used instead of Dialog.Title', async () => {
    render(
      <Dialog.Root open>
        <Dialog.Portal>
          <Dialog.Content aria-label="My Modal" aria-describedby={undefined}>
            <p>Content with aria-label</p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )

    const results = await axe(document.body)
    const dialogNameViolation = results.violations.find((v) => v.id === 'aria-dialog-name')
    expect(dialogNameViolation).toBeUndefined()
  })
})
