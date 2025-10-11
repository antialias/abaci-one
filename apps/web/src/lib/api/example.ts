/**
 * Example API hooks using React Query
 *
 * This file demonstrates how to use React Query with the configured
 * QueryClient and apiUrl helper for making API requests.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/queryClient'

// Example type for an API resource
interface User {
  id: string
  name: string
  email: string
}

/**
 * Example query hook - fetches a list of users
 */
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api('users')
      if (!response.ok) {
        throw new Error('Failed to fetch users')
      }
      return response.json() as Promise<User[]>
    },
  })
}

/**
 * Example query hook - fetches a single user by ID
 */
export function useUser(userId: string) {
  return useQuery({
    queryKey: ['users', userId],
    queryFn: async () => {
      const response = await api(`users/${userId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch user')
      }
      return response.json() as Promise<User>
    },
    enabled: !!userId, // Only run query if userId is provided
  })
}

/**
 * Example mutation hook - creates a new user
 */
export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (newUser: Omit<User, 'id'>) => {
      const response = await api('users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newUser),
      })
      if (!response.ok) {
        throw new Error('Failed to create user')
      }
      return response.json() as Promise<User>
    },
    onSuccess: () => {
      // Invalidate and refetch users query after successful creation
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

/**
 * Example mutation hook - updates a user
 */
export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (user: User) => {
      const response = await api(`users/${user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      })
      if (!response.ok) {
        throw new Error('Failed to update user')
      }
      return response.json() as Promise<User>
    },
    onSuccess: (updatedUser) => {
      // Invalidate both the list and the individual user query
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['users', updatedUser.id] })
    },
  })
}

/**
 * Example mutation hook - deletes a user
 */
export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await api(`users/${userId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete user')
      }
    },
    onSuccess: () => {
      // Invalidate users query after successful deletion
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
