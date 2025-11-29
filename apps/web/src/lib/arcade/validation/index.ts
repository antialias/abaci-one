/**
 * Game validator registry
 * @deprecated This file now re-exports from the unified registry
 * New code should import from '@/lib/arcade/validators' instead
 */

// Re-export core functions and types from unified registry
export {
  getValidator,
  hasValidator,
  getRegisteredGameNames,
} from '../validators'

export type { GameName } from '../validators'
export * from './types'
