/**
 * Theme system, layout utilities, hooks, and helper functions
 * Features: Theme presets, compact mode, column highlighting, hooks, utility functions
 */

import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import AbacusReact from './AbacusReact';
import {
  ABACUS_THEMES,
  AbacusThemeName,
  useAbacusDiff,
  useAbacusState,
  numberToAbacusState,
  abacusStateToNumber,
  calculateBeadDiffFromValues,
  validateAbacusValue,
  areStatesEqual
} from './index';

const meta = {
  title: 'AbacusReact/Themes & Utilities',
  component: AbacusReact,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof AbacusReact>;

export default meta;
type Story = StoryObj<typeof meta>;

// ============================================================================
// THEME PRESETS
// ============================================================================

export const AllThemePresets: Story = {
  render: () => {
    const themes: AbacusThemeName[] = ['light', 'dark', 'trophy', 'translucent', 'solid', 'traditional'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', padding: '20px' }}>
        <h2>Theme Presets</h2>
        <p>Pre-defined themes eliminate manual style object creation</p>

        {themes.map((themeName) => (
          <div key={themeName} style={{
            background: themeName === 'dark' ? '#1a1a1a' : '#f5f5f5',
            padding: '20px',
            borderRadius: '8px'
          }}>
            <h3 style={{
              marginTop: 0,
              color: themeName === 'dark' ? 'white' : 'black',
              textTransform: 'capitalize'
            }}>
              {themeName} Theme
            </h3>
            <AbacusReact
              value={12345}
              columns={5}
              customStyles={ABACUS_THEMES[themeName]}
              showNumbers={true}
            />
          </div>
        ))}
      </div>
    );
  },
};

export const LightTheme: Story = {
  render: () => (
    <div style={{ padding: '20px', background: '#f5f5f5' }}>
      <h3>Light Theme - Best for light backgrounds</h3>
      <AbacusReact
        value={12345}
        columns={5}
        customStyles={ABACUS_THEMES.light}
        showNumbers={true}
      />
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <div style={{ padding: '20px', background: '#1a1a1a' }}>
      <h3 style={{ color: 'white' }}>Dark Theme - Best for dark backgrounds</h3>
      <AbacusReact
        value={12345}
        columns={5}
        customStyles={ABACUS_THEMES.dark}
        showNumbers={true}
      />
    </div>
  ),
};

export const TrophyTheme: Story = {
  render: () => (
    <div style={{ padding: '20px', background: '#f0f0f0' }}>
      <h3>Trophy Theme - Golden frame for achievements</h3>
      <AbacusReact
        value={9999}
        columns={4}
        customStyles={ABACUS_THEMES.trophy}
        showNumbers={true}
      />
    </div>
  ),
};

export const TraditionalTheme: Story = {
  render: () => (
    <div style={{ padding: '20px', background: '#f5f5f0' }}>
      <h3>Traditional Theme - Brown wooden soroban aesthetic</h3>
      <AbacusReact
        value={8765}
        columns={4}
        customStyles={ABACUS_THEMES.traditional}
        showNumbers={true}
      />
    </div>
  ),
};

// ============================================================================
// COMPACT MODE & FRAME VISIBILITY
// ============================================================================

export const CompactMode: Story = {
  render: () => (
    <div style={{ padding: '20px' }}>
      <h3>Compact Mode - Inline mini-abacus displays</h3>
      <p>Perfect for inline number displays, badges, or game UI</p>

      <div style={{ display: 'flex', gap: '20px', alignItems: 'center', marginTop: '20px' }}>
        <span>Single digits: </span>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <AbacusReact
            key={num}
            value={num}
            columns={1}
            compact={true}
            hideInactiveBeads={true}
            scaleFactor={0.6}
          />
        ))}
      </div>

      <div style={{ marginTop: '30px' }}>
        <h4>Two-digit compact displays:</h4>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
          {[12, 34, 56, 78, 99].map(num => (
            <AbacusReact
              key={num}
              value={num}
              columns={2}
              compact={true}
              hideInactiveBeads={true}
              scaleFactor={0.7}
            />
          ))}
        </div>
      </div>
    </div>
  ),
};

export const FrameVisibilityControl: Story = {
  render: () => {
    const [frameVisible, setFrameVisible] = useState(true);

    return (
      <div style={{ padding: '20px' }}>
        <h3>Frame Visibility Control</h3>
        <p>Toggle column posts and reckoning bar on/off</p>

        <div style={{ marginBottom: '20px' }}>
          <label>
            <input
              type="checkbox"
              checked={frameVisible}
              onChange={(e) => setFrameVisible(e.target.checked)}
            />
            {' '}Show Frame
          </label>
        </div>

        <AbacusReact
          value={12345}
          columns={5}
          frameVisible={frameVisible}
          showNumbers={true}
        />
      </div>
    );
  },
};

// ============================================================================
// COLUMN HIGHLIGHTING & LABELS
// ============================================================================

export const ColumnHighlighting: Story = {
  render: () => (
    <div style={{ padding: '20px' }}>
      <h3>Column Highlighting</h3>
      <p>Highlight specific columns for educational purposes</p>

      <div style={{ marginBottom: '30px' }}>
        <h4>Highlight ones column:</h4>
        <AbacusReact
          value={12345}
          columns={5}
          highlightColumns={[0]}
          showNumbers={true}
        />
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h4>Highlight tens and hundreds:</h4>
        <AbacusReact
          value={12345}
          columns={5}
          highlightColumns={[1, 2]}
          showNumbers={true}
        />
      </div>

      <div>
        <h4>Highlight all columns:</h4>
        <AbacusReact
          value={12345}
          columns={5}
          highlightColumns={[0, 1, 2, 3, 4]}
          showNumbers={true}
        />
      </div>
    </div>
  ),
};

export const ColumnLabels: Story = {
  render: () => (
    <div style={{ padding: '20px' }}>
      <h3>Column Labels</h3>
      <p>Add educational labels above columns</p>

      <div style={{ marginBottom: '30px' }}>
        <h4>Standard place value labels:</h4>
        <AbacusReact
          value={12345}
          columns={5}
          columnLabels={['ones', 'tens', 'hundreds', 'thousands', '10k']}
          showNumbers={true}
        />
      </div>

      <div>
        <h4>Custom labels:</h4>
        <AbacusReact
          value={789}
          columns={3}
          columnLabels={['1s', '10s', '100s']}
          highlightColumns={[1]}
          showNumbers={true}
        />
      </div>
    </div>
  ),
};

export const ColumnHighlightingWithLabels: Story = {
  render: () => (
    <div style={{ padding: '20px' }}>
      <h3>Combined: Column Highlighting + Labels</h3>
      <p>Perfect for tutorials showing which column to work with</p>

      <AbacusReact
        value={42}
        columns={3}
        highlightColumns={[1]}
        columnLabels={['ones', 'tens', 'hundreds']}
        showNumbers={true}
      />

      <p style={{ marginTop: '20px', fontStyle: 'italic' }}>
        "Add 10 to the tens column"
      </p>
    </div>
  ),
};

// ============================================================================
// HOOKS: useAbacusDiff
// ============================================================================

function AbacusDiffDemo() {
  const [currentValue, setCurrentValue] = useState(5);
  const targetValue = 23;

  const diff = useAbacusDiff(currentValue, targetValue);

  return (
    <div style={{ padding: '20px' }}>
      <h3>useAbacusDiff Hook</h3>
      <p>Automatically calculate which beads need to move</p>

      <div style={{ marginBottom: '20px' }}>
        <p><strong>Current value:</strong> {currentValue}</p>
        <p><strong>Target value:</strong> {targetValue}</p>
        <p><strong>Instructions:</strong> {diff.summary}</p>
        <p><strong>Changes needed:</strong> {diff.changes.length}</p>
      </div>

      <AbacusReact
        value={currentValue}
        columns={2}
        stepBeadHighlights={diff.highlights}
        showNumbers={true}
        interactive={true}
        onValueChange={setCurrentValue}
      />

      <div style={{ marginTop: '20px' }}>
        <button onClick={() => setCurrentValue(5)}>Reset to 5</button>
        {' '}
        <button onClick={() => setCurrentValue(targetValue)}>Jump to target (23)</button>
      </div>

      {diff.hasChanges ? (
        <div style={{ marginTop: '20px', color: '#666' }}>
          <p><strong>Detailed changes:</strong></p>
          <pre style={{ fontSize: '12px' }}>
            {JSON.stringify(diff.changes, null, 2)}
          </pre>
        </div>
      ) : (
        <p style={{ marginTop: '20px', color: 'green', fontWeight: 'bold' }}>
          ✓ Target reached!
        </p>
      )}
    </div>
  );
}

export const UseAbacusDiffHook: Story = {
  render: () => <AbacusDiffDemo />,
};

// ============================================================================
// HOOKS: useAbacusState
// ============================================================================

function AbacusStateDemo() {
  const [value, setValue] = useState(123);
  const state = useAbacusState(value);

  return (
    <div style={{ padding: '20px' }}>
      <h3>useAbacusState Hook</h3>
      <p>Convert numbers to bead positions (memoized)</p>

      <div style={{ marginBottom: '20px' }}>
        <label>
          Value:
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(parseInt(e.target.value) || 0)}
            style={{ marginLeft: '10px', width: '100px' }}
          />
        </label>
      </div>

      <AbacusReact
        value={value}
        columns={3}
        showNumbers={true}
      />

      <div style={{ marginTop: '20px', fontSize: '14px' }}>
        <p><strong>Bead State Analysis:</strong></p>
        <table style={{ borderCollapse: 'collapse', marginTop: '10px' }}>
          <thead>
            <tr style={{ background: '#f0f0f0' }}>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Place</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Heaven Active?</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Earth Count</th>
              <th style={{ border: '1px solid #ccc', padding: '8px' }}>Digit</th>
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2].map(place => {
              const placeState = state[place];
              const digit = (placeState.heavenActive ? 5 : 0) + placeState.earthActive;
              const placeName = ['Ones', 'Tens', 'Hundreds'][place];

              return (
                <tr key={place}>
                  <td style={{ border: '1px solid #ccc', padding: '8px' }}>{placeName}</td>
                  <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                    {placeState.heavenActive ? '✓' : '✗'}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                    {placeState.earthActive}
                  </td>
                  <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                    {digit}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const UseAbacusStateHook: Story = {
  render: () => <AbacusStateDemo />,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function UtilityFunctionsDemo() {
  const [inputValue, setInputValue] = useState(123);

  const state = numberToAbacusState(inputValue, 5);
  const backToNumber = abacusStateToNumber(state);

  const fromValue = 42;
  const toValue = 57;
  const diff = calculateBeadDiffFromValues(fromValue, toValue);

  const validation1 = validateAbacusValue(inputValue, 5);
  const validation2 = validateAbacusValue(123456, 5);

  const state1 = numberToAbacusState(100);
  const state2 = numberToAbacusState(100);
  const state3 = numberToAbacusState(200);
  const areEqual1 = areStatesEqual(state1, state2);
  const areEqual2 = areStatesEqual(state1, state3);

  return (
    <div style={{ padding: '20px' }}>
      <h3>Utility Functions</h3>
      <p>Low-level functions for working with abacus states</p>

      <div style={{ marginBottom: '30px' }}>
        <h4>numberToAbacusState & abacusStateToNumber:</h4>
        <label>
          Input value:
          <input
            type="number"
            value={inputValue}
            onChange={(e) => setInputValue(parseInt(e.target.value) || 0)}
            style={{ marginLeft: '10px', width: '100px' }}
          />
        </label>
        <pre style={{ background: '#f5f5f5', padding: '10px', marginTop: '10px', fontSize: '12px' }}>
          {`numberToAbacusState(${inputValue}, 5) = ${JSON.stringify(state, null, 2)}`}
        </pre>
        <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
          {`abacusStateToNumber(state) = ${backToNumber}`}
        </pre>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h4>calculateBeadDiffFromValues:</h4>
        <p>From {fromValue} to {toValue}:</p>
        <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
          {`Summary: ${diff.summary}\nChanges: ${diff.changes.length}`}
        </pre>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <h4>validateAbacusValue:</h4>
        <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
          {`validateAbacusValue(${inputValue}, 5):\n  isValid: ${validation1.isValid}\n  error: ${validation1.error || 'none'}`}
        </pre>
        <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
          {`validateAbacusValue(123456, 5):\n  isValid: ${validation2.isValid}\n  error: ${validation2.error || 'none'}`}
        </pre>
      </div>

      <div>
        <h4>areStatesEqual:</h4>
        <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '12px' }}>
          {`areStatesEqual(state(100), state(100)) = ${areEqual1}\nareStatesEqual(state(100), state(200)) = ${areEqual2}`}
        </pre>
      </div>
    </div>
  );
}

export const UtilityFunctions: Story = {
  render: () => <UtilityFunctionsDemo />,
};

// ============================================================================
// COMBINED FEATURES
// ============================================================================

export const AllFeaturesShowcase: Story = {
  render: () => {
    const [value, setValue] = useState(42);
    const targetValue = 75;
    const diff = useAbacusDiff(value, targetValue);

    return (
      <div style={{ padding: '20px', maxWidth: '800px' }}>
        <h2>All New Features Combined</h2>
        <p>Theme preset + column highlighting + labels + diff hook</p>

        <div style={{
          background: '#1a1a1a',
          padding: '30px',
          borderRadius: '8px',
          marginTop: '20px'
        }}>
          <h3 style={{ color: 'white', marginTop: 0 }}>
            Tutorial: Add to reach {targetValue}
          </h3>

          <p style={{ color: '#ccc' }}>
            <strong>Current:</strong> {value} → <strong>Target:</strong> {targetValue}
          </p>
          <p style={{ color: '#fbbf24' }}>
            <strong>Instructions:</strong> {diff.summary}
          </p>

          <AbacusReact
            value={value}
            columns={2}
            customStyles={ABACUS_THEMES.dark}
            highlightColumns={[0, 1]}
            columnLabels={['ones', 'tens']}
            stepBeadHighlights={diff.highlights}
            showNumbers={true}
            interactive={true}
            onValueChange={setValue}
          />

          <div style={{ marginTop: '20px' }}>
            <button onClick={() => setValue(42)}>Reset</button>
            {' '}
            <button onClick={() => setValue(targetValue)}>Show Answer</button>
          </div>

          {!diff.hasChanges && (
            <p style={{ color: '#4ade80', fontWeight: 'bold', marginTop: '20px' }}>
              🎉 Perfect! You reached the target!
            </p>
          )}
        </div>
      </div>
    );
  },
};

export const CompactThemeComparison: Story = {
  render: () => {
    const themes: AbacusThemeName[] = ['light', 'dark', 'trophy', 'traditional'];

    return (
      <div style={{ padding: '20px' }}>
        <h3>Compact Mode with Different Themes</h3>
        <p>Inline displays work with all theme presets</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px' }}>
          {themes.map(theme => (
            <div
              key={theme}
              style={{
                background: theme === 'dark' ? '#1a1a1a' : '#f5f5f5',
                padding: '15px',
                borderRadius: '6px'
              }}
            >
              <h4 style={{
                margin: '0 0 15px 0',
                color: theme === 'dark' ? 'white' : 'black',
                textTransform: 'capitalize'
              }}>
                {theme}:
              </h4>
              <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                {[7, 42, 99].map(num => (
                  <div key={num}>
                    <AbacusReact
                      value={num}
                      columns={num < 10 ? 1 : 2}
                      compact={true}
                      hideInactiveBeads={true}
                      customStyles={ABACUS_THEMES[theme]}
                      scaleFactor={0.7}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};
