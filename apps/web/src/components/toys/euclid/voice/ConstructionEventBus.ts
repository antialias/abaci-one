import type { ConstructionEvent } from './useConstructionNotifier'

type Listener = (event: ConstructionEvent) => void

export class ConstructionEventBus {
  private listeners = new Set<Listener>()

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  emit(event: ConstructionEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}
