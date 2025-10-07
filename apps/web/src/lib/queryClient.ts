import { type DefaultOptions, QueryClient } from '@tanstack/react-query'

const queryConfig: DefaultOptions = {
  queries: {
    // Default stale time of 5 minutes
    staleTime: 1000 * 60 * 5,
    // Retry failed requests once
    retry: 1,
    // Refetch on window focus in production only
    refetchOnWindowFocus: process.env.NODE_ENV === 'production',
  },
}

/**
 * Creates a new QueryClient instance with default configuration.
 * All API routes are expected to be prefixed with /api.
 */
export function createQueryClient() {
  return new QueryClient({
    defaultOptions: queryConfig,
  })
}

/**
 * Helper function to construct API URLs with the /api prefix.
 * Use this for consistency when making API calls.
 *
 * @param path - The API path without the /api prefix (e.g., 'users', 'posts/123')
 * @returns The full API URL (e.g., '/api/users', '/api/posts/123')
 *
 * @example
 * ```ts
 * const url = apiUrl('users') // '/api/users'
 * const url = apiUrl('posts/123') // '/api/posts/123'
 * ```
 */
export function apiUrl(path: string): string {
  // Remove leading slash if present to avoid double slashes
  const cleanPath = path.startsWith('/') ? path.slice(1) : path
  return `/api/${cleanPath}`
}

/**
 * Wrapper around fetch that automatically prefixes paths with /api.
 * Provides a consistent way to make API calls throughout the application.
 *
 * @param path - The API path without the /api prefix (e.g., 'users', 'posts/123')
 * @param options - Standard fetch options (method, headers, body, etc.)
 * @returns Promise with the fetch Response
 *
 * @example
 * ```ts
 * // GET request
 * const response = await api('users')
 * const users = await response.json()
 *
 * // POST request
 * const response = await api('users', {
 *   method: 'POST',
 *   headers: { 'Content-Type': 'application/json' },
 *   body: JSON.stringify({ name: 'John' })
 * })
 * ```
 */
export function api(path: string, options?: RequestInit): Promise<Response> {
  return fetch(apiUrl(path), options)
}
