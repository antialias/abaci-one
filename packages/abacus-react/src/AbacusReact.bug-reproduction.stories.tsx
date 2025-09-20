import type { Meta, StoryObj } from '@storybook/react'
import React, { useState, useCallback } from 'react'
import { AbacusReact } from './AbacusReact'

const meta: Meta<typeof AbacusReact> = {
  title: 'Bug Reports/Interaction Issues',
  component: AbacusReact,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Stories for reproducing and testing interaction bugs in the AbacusReact component.'
      }
    }
  },
  tags: ['autodocs']
}

export default meta
type Story = StoryObj<typeof meta>

// Story to reproduce the zero-state interaction bug
const ZeroStateInteractionTest = () => {
  const [value, setValue] = useState(0)
  const [clickLog, setClickLog] = useState<string[]>([])

  const handleValueChange = useCallback((newValue: number) => {
    setValue(newValue)
    const timestamp = new Date().toLocaleTimeString()
    setClickLog(prev => [...prev, `${timestamp}: Value changed to ${newValue}`].slice(-10))
  }, [])

  const handleBeadClick = useCallback((bead: any) => {
    const timestamp = new Date().toLocaleTimeString()
    setClickLog(prev => [...prev,
      `${timestamp}: Clicked ${bead.type} bead at column ${bead.columnIndex}, position ${bead.position}, active: ${bead.active}`,
      `  -> This should affect column ${bead.columnIndex} in the state`
    ].slice(-15))
  }, [])

  const handleColumnClick = useCallback((columnIndex: number) => {
    const timestamp = new Date().toLocaleTimeString()
    setClickLog(prev => [...prev,
      `${timestamp}: Clicked column ${columnIndex} (numeral area)`
    ].slice(-15))
  }, [])

  const resetToZero = () => {
    setValue(0)
    setClickLog([])
  }

  const setTestValue = () => {
    setValue(12345)
    setClickLog([])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
      <div style={{
        background: '#f5f5f5',
        padding: '15px',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '14px'
      }}>
        <h3 style={{ margin: '0 0 10px 0' }}>Interaction Debug Panel</h3>
        <div><strong>Current Value:</strong> {value}</div>
        <div style={{ marginTop: '10px' }}>
          <button
            onClick={resetToZero}
            style={{
              marginRight: '10px',
              padding: '5px 10px',
              background: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reset to 0 (reproduce bug)
          </button>
          <button
            onClick={setTestValue}
            style={{
              padding: '5px 10px',
              background: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Set to 12345 (test working state)
          </button>
        </div>

        <div style={{ marginTop: '15px' }}>
          <strong>Click Log (last 10 events):</strong>
          <div style={{
            maxHeight: '200px',
            overflowY: 'auto',
            marginTop: '5px',
            background: 'white',
            padding: '5px',
            border: '1px solid #ddd',
            borderRadius: '4px'
          }}>
            {clickLog.length === 0 ? (
              <div style={{ color: '#666', fontStyle: 'italic' }}>
                No clicks yet. Try clicking on different beads to see if they respond correctly.
              </div>
            ) : (
              clickLog.map((log, index) => (
                <div key={index} style={{ marginBottom: '2px' }}>{log}</div>
              ))
            )}
          </div>
        </div>

        <div style={{ marginTop: '15px', fontSize: '12px', color: '#666' }}>
          <strong>Bug Description:</strong> When starting with value 0, clicks on beads may not respond correctly
          or may control the wrong column. The issue typically resolves after clicking on the rightmost column.
        </div>
      </div>

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        border: '2px solid #ddd'
      }}>
        <AbacusReact
          value={value}
          columns={5}
          beadShape="diamond"
          colorScheme="place-value"
          hideInactiveBeads={false}
          scaleFactor={2.0}
          interactive={true}
          showNumbers={true}
          animated={true}
          onValueChange={handleValueChange}
          callbacks={{
            onBeadClick: handleBeadClick,
            onColumnClick: handleColumnClick
          }}
        />
      </div>
    </div>
  )
}

export const ZeroStateInteractionBug: Story = {
  render: () => <ZeroStateInteractionTest />,
  parameters: {
    docs: {
      description: {
        story: `
### Bug Reproduction Test

This story helps reproduce and debug the interaction issue where:

1. **Problem**: When the abacus starts with value 0, clicking on beads may not respond correctly or may control the wrong column
2. **Workaround**: The issue typically resolves after clicking on the rightmost column first
3. **Test Steps**:
   - Click "Reset to 0" to reproduce the bug condition
   - Try clicking on beads in different columns, especially leftmost columns
   - Observe which clicks register and which don't
   - Click "Set to 12345" to test if non-zero values work correctly
   - Watch the debug log to see exactly which bead clicks are being detected

### Expected Behavior
All bead clicks should register correctly regardless of the current abacus value.

### Actual Behavior
When starting from 0, some bead clicks don't register or control the wrong column until the rightmost column is clicked first.
        `
      }
    }
  }
}

// Additional test with different configurations
const MultiscaleInteractionTest = () => {
  const [configs] = useState([
    { columns: 1, scaleFactor: 1.0, label: '1 Column, 1x Scale' },
    { columns: 3, scaleFactor: 1.5, label: '3 Columns, 1.5x Scale' },
    { columns: 5, scaleFactor: 2.0, label: '5 Columns, 2x Scale' },
    { columns: 7, scaleFactor: 2.5, label: '7 Columns, 2.5x Scale' }
  ])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', padding: '20px' }}>
      {configs.map((config, index) => (
        <TestAbacus key={index} {...config} />
      ))}
    </div>
  )
}

const TestAbacus = ({ columns, scaleFactor, label }: { columns: number, scaleFactor: number, label: string }) => {
  const [value, setValue] = useState(0)
  const [lastClick, setLastClick] = useState<string>('')

  const handleBeadClick = useCallback((bead: any) => {
    setLastClick(`${bead.type}[${bead.columnIndex}:${bead.position}]`)
  }, [])

  return (
    <div style={{
      border: '1px solid #ddd',
      borderRadius: '8px',
      padding: '15px',
      background: '#fafafa'
    }}>
      <h4 style={{ margin: '0 0 10px 0', fontSize: '14px' }}>{label}</h4>
      <div style={{ fontSize: '12px', marginBottom: '10px', fontFamily: 'monospace' }}>
        Value: {value} | Last Click: {lastClick || 'none'}
      </div>
      <button
        onClick={() => setValue(0)}
        style={{
          fontSize: '11px',
          padding: '3px 6px',
          marginBottom: '10px',
          background: '#dc3545',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
      >
        Reset to 0
      </button>
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <AbacusReact
          value={value}
          columns={columns}
          beadShape="diamond"
          colorScheme="place-value"
          hideInactiveBeads={false}
          scaleFactor={scaleFactor}
          interactive={true}
          showNumbers={true}
          animated={true}
          onValueChange={setValue}
          callbacks={{
            onBeadClick: handleBeadClick
          }}
        />
      </div>
    </div>
  )
}

export const MultiConfigurationTest: Story = {
  render: () => <MultiscaleInteractionTest />,
  parameters: {
    docs: {
      description: {
        story: `
### Multi-Configuration Interaction Test

This story tests the interaction bug across different abacus configurations to help identify if the issue is related to:

- Number of columns
- Scale factor
- Rendering dimensions
- Column spacing calculations

Each abacus can be independently reset to 0 to test the bug reproduction across different setups.
        `
      }
    }
  }
}