/**
 * Model Registry for Vision Training
 *
 * This registry maps model types to their specific panel components.
 * Each model type can have custom Data, Train, Test, and Sessions panels.
 *
 * Architecture: Shared Shell + Swappable Panels
 * - VisionTrainingShell handles the common UI (model selector, tabs)
 * - Panels are looked up from this registry based on selected model type
 */

import type { ComponentType } from 'react'
import type { ModelType } from './train/components/wizard/types'

// Panel prop interfaces (minimal, each panel manages its own state)
export interface DataPanelProps {
  onDataChanged?: () => void
}

export interface TrainPanelProps {
  // Props passed from shell - can be extended as needed
}

export interface TestPanelProps {
  sessionId?: string
}

export interface SessionsPanelProps {
  modelType: ModelType
  onSessionSelect?: (id: string) => void
}

// Registry entry for a model type
export interface ModelRegistryEntry {
  label: string
  description: string
  DataPanel: ComponentType<DataPanelProps>
  TrainPanel: ComponentType<TrainPanelProps>
  TestPanel: ComponentType<TestPanelProps>
  SessionsPanel: ComponentType<SessionsPanelProps>
}

// Placeholder component type for initial setup
type PlaceholderComponent = ComponentType<Record<string, unknown>>

// Placeholder - will be replaced with actual imports
// These are defined lazily to avoid circular imports
let _boundaryDataPanel: PlaceholderComponent | null = null
let _columnClassifierDataPanel: PlaceholderComponent | null = null
let _boundaryTrainPanel: PlaceholderComponent | null = null
let _columnClassifierTrainPanel: PlaceholderComponent | null = null
let _boundaryTestPanel: PlaceholderComponent | null = null
let _columnClassifierTestPanel: PlaceholderComponent | null = null
let _sharedSessionsPanel: PlaceholderComponent | null = null

// Registry initialization function - called once panels are available
export function registerPanels(panels: {
  BoundaryDataPanel: PlaceholderComponent
  ColumnClassifierDataPanel: PlaceholderComponent
  BoundaryTrainPanel: PlaceholderComponent
  ColumnClassifierTrainPanel: PlaceholderComponent
  BoundaryTestPanel: PlaceholderComponent
  ColumnClassifierTestPanel: PlaceholderComponent
  SharedSessionsPanel: PlaceholderComponent
}) {
  _boundaryDataPanel = panels.BoundaryDataPanel
  _columnClassifierDataPanel = panels.ColumnClassifierDataPanel
  _boundaryTrainPanel = panels.BoundaryTrainPanel
  _columnClassifierTrainPanel = panels.ColumnClassifierTrainPanel
  _boundaryTestPanel = panels.BoundaryTestPanel
  _columnClassifierTestPanel = panels.ColumnClassifierTestPanel
  _sharedSessionsPanel = panels.SharedSessionsPanel
}

// Fallback placeholder component
function PlaceholderPanel({ name }: { name: string }) {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>
      <p>Panel not yet registered: {name}</p>
    </div>
  )
}

// Helper to get model registry entry
export function getModelEntry(modelType: ModelType): ModelRegistryEntry {
  switch (modelType) {
    case 'boundary-detector':
      return {
        label: 'Boundary Detector',
        description: 'Detects abacus boundaries in camera frames',
        DataPanel: _boundaryDataPanel ?? (() => <PlaceholderPanel name="BoundaryDataPanel" />),
        TrainPanel: _boundaryTrainPanel ?? (() => <PlaceholderPanel name="BoundaryTrainPanel" />),
        TestPanel: _boundaryTestPanel ?? (() => <PlaceholderPanel name="BoundaryTestPanel" />),
        SessionsPanel:
          _sharedSessionsPanel ?? (() => <PlaceholderPanel name="SharedSessionsPanel" />),
      }
    case 'column-classifier':
      return {
        label: 'Column Classifier',
        description: 'Classifies abacus column values (0-9)',
        DataPanel:
          _columnClassifierDataPanel ??
          (() => <PlaceholderPanel name="ColumnClassifierDataPanel" />),
        TrainPanel:
          _columnClassifierTrainPanel ??
          (() => <PlaceholderPanel name="ColumnClassifierTrainPanel" />),
        TestPanel:
          _columnClassifierTestPanel ??
          (() => <PlaceholderPanel name="ColumnClassifierTestPanel" />),
        SessionsPanel:
          _sharedSessionsPanel ?? (() => <PlaceholderPanel name="SharedSessionsPanel" />),
      }
    default: {
      const exhaustiveCheck: never = modelType
      throw new Error(`Unknown model type: ${exhaustiveCheck}`)
    }
  }
}

// Get all model types for iteration
export function getAllModelTypes(): ModelType[] {
  return ['boundary-detector', 'column-classifier']
}

// Get label for a model type
export function getModelLabel(modelType: ModelType): string {
  return getModelEntry(modelType).label
}

// Tab definitions
export type TabId = 'data' | 'train' | 'test' | 'sessions'

export interface TabDefinition {
  id: TabId
  label: string
  icon: string
}

export const TABS: TabDefinition[] = [
  { id: 'data', label: 'Data', icon: '📊' },
  { id: 'train', label: 'Train', icon: '🏋️' },
  { id: 'test', label: 'Test', icon: '🧪' },
  { id: 'sessions', label: 'Sessions', icon: '📁' },
]
