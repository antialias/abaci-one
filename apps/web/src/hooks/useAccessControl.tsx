'use client'

import { createContext, type ReactNode, useContext } from 'react'
import type { AccessContext, Permission, UserRole } from '../types/tutorial'

// Default context value (no permissions)
const defaultAccessContext: AccessContext = {
  userId: undefined,
  roles: [],
  isAuthenticated: false,
  isAdmin: false,
  canEdit: false,
  canPublish: false,
  canDelete: false,
}

// Create context
const AccessControlContext = createContext<AccessContext>(defaultAccessContext)

// Provider component
interface AccessControlProviderProps {
  children: ReactNode
  userId?: string
  roles?: UserRole[]
  isAuthenticated?: boolean
}

export function AccessControlProvider({
  children,
  userId,
  roles = [],
  isAuthenticated = false,
}: AccessControlProviderProps) {
  // Calculate permissions based on roles
  const permissions = roles.flatMap((role) => role.permissions)

  // Check if user has admin role
  const isAdmin = roles.some((role) => role.name === 'admin' || role.name === 'superuser')

  // Check specific permissions
  const canEdit =
    isAdmin || permissions.some((p) => p.resource === 'tutorial' && p.actions.includes('update'))

  const canPublish =
    isAdmin || permissions.some((p) => p.resource === 'tutorial' && p.actions.includes('publish'))

  const canDelete =
    isAdmin || permissions.some((p) => p.resource === 'tutorial' && p.actions.includes('delete'))

  const accessContext: AccessContext = {
    userId,
    roles,
    isAuthenticated,
    isAdmin,
    canEdit,
    canPublish,
    canDelete,
  }

  return (
    <AccessControlContext.Provider value={accessContext}>{children}</AccessControlContext.Provider>
  )
}

// Hook to use access control
export function useAccessControl(): AccessContext {
  const context = useContext(AccessControlContext)
  if (!context) {
    throw new Error('useAccessControl must be used within an AccessControlProvider')
  }
  return context
}

// Hook for conditional rendering based on permissions
export function usePermission(
  resource: Permission['resource'],
  action: Permission['actions'][number]
): boolean {
  const { isAdmin, roles } = useAccessControl()

  if (isAdmin) return true

  return roles.some((role) =>
    role.permissions.some(
      (permission) => permission.resource === resource && permission.actions.includes(action)
    )
  )
}

// Hook for editor access specifically
export function useEditorAccess(): {
  canAccessEditor: boolean
  canEditTutorials: boolean
  canPublishTutorials: boolean
  canDeleteTutorials: boolean
  reason?: string
} {
  const { isAuthenticated, isAdmin, canEdit, canPublish, canDelete } = useAccessControl()

  if (!isAuthenticated) {
    return {
      canAccessEditor: false,
      canEditTutorials: false,
      canPublishTutorials: false,
      canDeleteTutorials: false,
      reason: 'Authentication required',
    }
  }

  const canAccessEditor = isAdmin || canEdit

  return {
    canAccessEditor,
    canEditTutorials: canEdit,
    canPublishTutorials: canPublish,
    canDeleteTutorials: canDelete,
    reason: canAccessEditor ? undefined : 'Insufficient permissions',
  }
}

// Higher-order component for protecting routes
interface ProtectedComponentProps {
  children: ReactNode
  fallback?: ReactNode
  requirePermissions?: {
    resource: Permission['resource']
    actions: Permission['actions']
  }[]
}

export function ProtectedComponent({
  children,
  fallback = <div>Access denied</div>,
  requirePermissions = [],
}: ProtectedComponentProps) {
  const { isAuthenticated, roles, isAdmin } = useAccessControl()

  if (!isAuthenticated) {
    return <>{fallback}</>
  }

  if (isAdmin) {
    return <>{children}</>
  }

  // Check if user has all required permissions
  const hasAllPermissions = requirePermissions.every(({ resource, actions }) =>
    roles.some((role) =>
      role.permissions.some(
        (permission) =>
          permission.resource === resource &&
          actions.every((action) => permission.actions.includes(action))
      )
    )
  )

  if (!hasAllPermissions) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// Component for editor-specific protection
interface EditorProtectedProps {
  children: ReactNode
  fallback?: ReactNode
}

export function EditorProtected({ children, fallback }: EditorProtectedProps) {
  const { canAccessEditor, reason } = useEditorAccess()

  if (!canAccessEditor) {
    return (
      <>
        {fallback || (
          <div className="text-center p-8">
            <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
            <p className="text-gray-600">{reason}</p>
          </div>
        )}
      </>
    )
  }

  return <>{children}</>
}

// Dev mode provider (for development without auth)
export function DevAccessProvider({ children }: { children: ReactNode }) {
  const devRoles: UserRole[] = [
    {
      id: 'dev-admin',
      name: 'admin',
      permissions: [
        {
          resource: 'tutorial',
          actions: ['create', 'read', 'update', 'delete', 'publish'],
        },
        {
          resource: 'step',
          actions: ['create', 'read', 'update', 'delete'],
        },
        {
          resource: 'user',
          actions: ['read', 'update'],
        },
        {
          resource: 'system',
          actions: ['read'],
        },
      ],
    },
  ]

  return (
    <AccessControlProvider userId="dev-user" roles={devRoles} isAuthenticated={true}>
      {children}
    </AccessControlProvider>
  )
}
