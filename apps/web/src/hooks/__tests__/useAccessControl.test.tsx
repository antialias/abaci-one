import { renderHook } from '@testing-library/react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { UserRole } from '@/types/tutorial'
import {
  AccessControlProvider,
  useAccessControl,
  usePermission,
  useEditorAccess,
  ProtectedComponent,
  EditorProtected,
  DevAccessProvider,
} from '../useAccessControl'

// ============================================================================
// Helpers
// ============================================================================

function createAdminRole(): UserRole {
  return {
    id: 'admin-role',
    name: 'admin',
    permissions: [
      { resource: 'tutorial', actions: ['create', 'read', 'update', 'delete', 'publish'] },
      { resource: 'step', actions: ['create', 'read', 'update', 'delete'] },
    ],
  }
}

function createEditorRole(): UserRole {
  return {
    id: 'editor-role',
    name: 'editor',
    permissions: [
      { resource: 'tutorial', actions: ['read', 'update'] },
      { resource: 'step', actions: ['read', 'update'] },
    ],
  }
}

function createViewerRole(): UserRole {
  return {
    id: 'viewer-role',
    name: 'viewer',
    permissions: [{ resource: 'tutorial', actions: ['read'] }],
  }
}

// ============================================================================
// useAccessControl
// ============================================================================

describe('useAccessControl', () => {
  it('returns default context when not authenticated', () => {
    const { result } = renderHook(() => useAccessControl(), {
      wrapper: ({ children }) => <AccessControlProvider>{children}</AccessControlProvider>,
    })

    expect(result.current.isAuthenticated).toBe(false)
    expect(result.current.isAdmin).toBe(false)
    expect(result.current.canEdit).toBe(false)
    expect(result.current.canPublish).toBe(false)
    expect(result.current.canDelete).toBe(false)
    expect(result.current.userId).toBeUndefined()
    expect(result.current.roles).toEqual([])
  })

  it('identifies admin users', () => {
    const adminRole = createAdminRole()
    const { result } = renderHook(() => useAccessControl(), {
      wrapper: ({ children }) => (
        <AccessControlProvider userId="admin-1" roles={[adminRole]} isAuthenticated={true}>
          {children}
        </AccessControlProvider>
      ),
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.canEdit).toBe(true)
    expect(result.current.canPublish).toBe(true)
    expect(result.current.canDelete).toBe(true)
    expect(result.current.userId).toBe('admin-1')
  })

  it('identifies superuser as admin', () => {
    const superuserRole: UserRole = {
      id: 'super-role',
      name: 'superuser',
      permissions: [],
    }
    const { result } = renderHook(() => useAccessControl(), {
      wrapper: ({ children }) => (
        <AccessControlProvider userId="super-1" roles={[superuserRole]} isAuthenticated={true}>
          {children}
        </AccessControlProvider>
      ),
    })

    expect(result.current.isAdmin).toBe(true)
  })

  it('grants edit permission based on role permissions', () => {
    const editorRole = createEditorRole()
    const { result } = renderHook(() => useAccessControl(), {
      wrapper: ({ children }) => (
        <AccessControlProvider userId="editor-1" roles={[editorRole]} isAuthenticated={true}>
          {children}
        </AccessControlProvider>
      ),
    })

    expect(result.current.isAdmin).toBe(false)
    expect(result.current.canEdit).toBe(true) // has 'update' on 'tutorial'
    expect(result.current.canPublish).toBe(false) // no 'publish' action
    expect(result.current.canDelete).toBe(false) // no 'delete' action
  })

  it('denies permissions for viewer role', () => {
    const viewerRole = createViewerRole()
    const { result } = renderHook(() => useAccessControl(), {
      wrapper: ({ children }) => (
        <AccessControlProvider userId="viewer-1" roles={[viewerRole]} isAuthenticated={true}>
          {children}
        </AccessControlProvider>
      ),
    })

    expect(result.current.canEdit).toBe(false)
    expect(result.current.canPublish).toBe(false)
    expect(result.current.canDelete).toBe(false)
  })
})

// ============================================================================
// usePermission
// ============================================================================

describe('usePermission', () => {
  it('returns true for admin users regardless of specific permission', () => {
    const adminRole = createAdminRole()
    const { result } = renderHook(() => usePermission('system', 'read'), {
      wrapper: ({ children }) => (
        <AccessControlProvider userId="admin-1" roles={[adminRole]} isAuthenticated={true}>
          {children}
        </AccessControlProvider>
      ),
    })

    expect(result.current).toBe(true)
  })

  it('returns true when role has matching permission', () => {
    const editorRole = createEditorRole()
    const { result } = renderHook(() => usePermission('tutorial', 'update'), {
      wrapper: ({ children }) => (
        <AccessControlProvider userId="editor-1" roles={[editorRole]} isAuthenticated={true}>
          {children}
        </AccessControlProvider>
      ),
    })

    expect(result.current).toBe(true)
  })

  it('returns false when role lacks matching permission', () => {
    const viewerRole = createViewerRole()
    const { result } = renderHook(() => usePermission('tutorial', 'delete'), {
      wrapper: ({ children }) => (
        <AccessControlProvider userId="viewer-1" roles={[viewerRole]} isAuthenticated={true}>
          {children}
        </AccessControlProvider>
      ),
    })

    expect(result.current).toBe(false)
  })
})

// ============================================================================
// useEditorAccess
// ============================================================================

describe('useEditorAccess', () => {
  it('denies access for unauthenticated users', () => {
    const { result } = renderHook(() => useEditorAccess(), {
      wrapper: ({ children }) => <AccessControlProvider>{children}</AccessControlProvider>,
    })

    expect(result.current.canAccessEditor).toBe(false)
    expect(result.current.canEditTutorials).toBe(false)
    expect(result.current.canPublishTutorials).toBe(false)
    expect(result.current.canDeleteTutorials).toBe(false)
    expect(result.current.reason).toBe('Authentication required')
  })

  it('grants full access for admin users', () => {
    const adminRole = createAdminRole()
    const { result } = renderHook(() => useEditorAccess(), {
      wrapper: ({ children }) => (
        <AccessControlProvider userId="admin-1" roles={[adminRole]} isAuthenticated={true}>
          {children}
        </AccessControlProvider>
      ),
    })

    expect(result.current.canAccessEditor).toBe(true)
    expect(result.current.canEditTutorials).toBe(true)
    expect(result.current.canPublishTutorials).toBe(true)
    expect(result.current.canDeleteTutorials).toBe(true)
    expect(result.current.reason).toBeUndefined()
  })

  it('grants editor access but not publish/delete for editor role', () => {
    const editorRole = createEditorRole()
    const { result } = renderHook(() => useEditorAccess(), {
      wrapper: ({ children }) => (
        <AccessControlProvider userId="editor-1" roles={[editorRole]} isAuthenticated={true}>
          {children}
        </AccessControlProvider>
      ),
    })

    expect(result.current.canAccessEditor).toBe(true)
    expect(result.current.canEditTutorials).toBe(true)
    expect(result.current.canPublishTutorials).toBe(false)
    expect(result.current.canDeleteTutorials).toBe(false)
  })

  it('denies editor access for viewer role with reason', () => {
    const viewerRole = createViewerRole()
    const { result } = renderHook(() => useEditorAccess(), {
      wrapper: ({ children }) => (
        <AccessControlProvider userId="viewer-1" roles={[viewerRole]} isAuthenticated={true}>
          {children}
        </AccessControlProvider>
      ),
    })

    expect(result.current.canAccessEditor).toBe(false)
    expect(result.current.reason).toBe('Insufficient permissions')
  })
})

// ============================================================================
// ProtectedComponent
// ============================================================================

describe('ProtectedComponent', () => {
  it('renders fallback when not authenticated', () => {
    render(
      <AccessControlProvider>
        <ProtectedComponent>
          <div>Protected Content</div>
        </ProtectedComponent>
      </AccessControlProvider>
    )

    expect(screen.getByText('Access denied')).toBeDefined()
    expect(screen.queryByText('Protected Content')).toBeNull()
  })

  it('renders children for admin users', () => {
    const adminRole = createAdminRole()
    render(
      <AccessControlProvider userId="admin-1" roles={[adminRole]} isAuthenticated={true}>
        <ProtectedComponent>
          <div>Protected Content</div>
        </ProtectedComponent>
      </AccessControlProvider>
    )

    expect(screen.getByText('Protected Content')).toBeDefined()
  })

  it('renders children when user has required permissions', () => {
    const editorRole = createEditorRole()
    render(
      <AccessControlProvider userId="editor-1" roles={[editorRole]} isAuthenticated={true}>
        <ProtectedComponent
          requirePermissions={[{ resource: 'tutorial', actions: ['read', 'update'] }]}
        >
          <div>Editor Content</div>
        </ProtectedComponent>
      </AccessControlProvider>
    )

    expect(screen.getByText('Editor Content')).toBeDefined()
  })

  it('renders fallback when user lacks required permissions', () => {
    const viewerRole = createViewerRole()
    render(
      <AccessControlProvider userId="viewer-1" roles={[viewerRole]} isAuthenticated={true}>
        <ProtectedComponent
          requirePermissions={[{ resource: 'tutorial', actions: ['update'] }]}
          fallback={<div>No Access</div>}
        >
          <div>Editor Content</div>
        </ProtectedComponent>
      </AccessControlProvider>
    )

    expect(screen.getByText('No Access')).toBeDefined()
    expect(screen.queryByText('Editor Content')).toBeNull()
  })

  it('renders custom fallback', () => {
    render(
      <AccessControlProvider>
        <ProtectedComponent fallback={<div>Custom Fallback</div>}>
          <div>Protected Content</div>
        </ProtectedComponent>
      </AccessControlProvider>
    )

    expect(screen.getByText('Custom Fallback')).toBeDefined()
  })
})

// ============================================================================
// EditorProtected
// ============================================================================

describe('EditorProtected', () => {
  it('renders fallback when not authenticated', () => {
    render(
      <AccessControlProvider>
        <EditorProtected>
          <div>Editor Content</div>
        </EditorProtected>
      </AccessControlProvider>
    )

    expect(screen.getByText('Access Restricted')).toBeDefined()
    expect(screen.queryByText('Editor Content')).toBeNull()
  })

  it('renders children for admin users', () => {
    const adminRole = createAdminRole()
    render(
      <AccessControlProvider userId="admin-1" roles={[adminRole]} isAuthenticated={true}>
        <EditorProtected>
          <div>Editor Content</div>
        </EditorProtected>
      </AccessControlProvider>
    )

    expect(screen.getByText('Editor Content')).toBeDefined()
  })

  it('renders custom fallback', () => {
    render(
      <AccessControlProvider>
        <EditorProtected fallback={<div>My Fallback</div>}>
          <div>Editor Content</div>
        </EditorProtected>
      </AccessControlProvider>
    )

    expect(screen.getByText('My Fallback')).toBeDefined()
  })
})

// ============================================================================
// DevAccessProvider
// ============================================================================

describe('DevAccessProvider', () => {
  it('provides admin access', () => {
    const { result } = renderHook(() => useAccessControl(), {
      wrapper: ({ children }) => <DevAccessProvider>{children}</DevAccessProvider>,
    })

    expect(result.current.isAuthenticated).toBe(true)
    expect(result.current.isAdmin).toBe(true)
    expect(result.current.canEdit).toBe(true)
    expect(result.current.canPublish).toBe(true)
    expect(result.current.canDelete).toBe(true)
    expect(result.current.userId).toBe('dev-user')
  })
})
