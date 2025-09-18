import React, { useState } from 'react';
import { AbacusReact, useAbacusDimensions, useAbacusState, BeadConfig } from './AbacusReact';

const AbacusExample: React.FC = () => {
  const [demoValue, setDemoValue] = useState(123);
  const [demoColumns, setDemoColumns] = useState<number | 'auto'>('auto');
  const [beadShape, setBeadShape] = useState<'diamond' | 'square' | 'circle'>('diamond');
  const [colorScheme, setColorScheme] = useState<'monochrome' | 'place-value' | 'alternating' | 'heaven-earth'>('place-value');
  const [colorPalette, setColorPalette] = useState<'default' | 'colorblind' | 'mnemonic' | 'grayscale' | 'nature'>('default');
  const [scaleFactor, setScaleFactor] = useState(1);
  const [animated, setAnimated] = useState(true);
  const [draggable, setDraggable] = useState(false);
  const [hideInactive, setHideInactive] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);

  // Demonstrate hooks usage
  const actualColumns = demoColumns === 'auto' ? Math.max(1, demoValue.toString().length) : demoColumns;
  const dimensions = useAbacusDimensions(actualColumns, scaleFactor);
  const { value, setValue, toggleBead } = useAbacusState(demoValue);

  const handleBeadClick = (bead: BeadConfig) => {
    console.log('Bead clicked:', {
      type: bead.type,
      value: bead.value,
      active: bead.active,
      column: bead.columnIndex,
      position: bead.position
    });
  };

  const handleValueChange = (newValue: number) => {
    console.log('Value changed to:', newValue);
    setDemoValue(newValue);
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Interactive Abacus React Component</h1>

      {/* Controls */}
      <div style={{ marginBottom: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <div>
          <label>
            Value:
            <input
              type="number"
              value={demoValue}
              onChange={(e) => setDemoValue(parseInt(e.target.value) || 0)}
              style={{ marginLeft: '5px', width: '80px' }}
              min="0"
              max="99999"
            />
          </label>
        </div>

        <div>
          <label>
            Columns:
            <select
              value={demoColumns}
              onChange={(e) => setDemoColumns(e.target.value === 'auto' ? 'auto' : parseInt(e.target.value))}
              style={{ marginLeft: '5px' }}
            >
              <option value="auto">Auto</option>
              {[1, 2, 3, 4, 5].map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Bead Shape:
            <select
              value={beadShape}
              onChange={(e) => setBeadShape(e.target.value as any)}
              style={{ marginLeft: '5px' }}
            >
              <option value="diamond">Diamond</option>
              <option value="square">Square</option>
              <option value="circle">Circle</option>
            </select>
          </label>
        </div>

        <div>
          <label>
            Color Scheme:
            <select
              value={colorScheme}
              onChange={(e) => setColorScheme(e.target.value as any)}
              style={{ marginLeft: '5px' }}
            >
              <option value="monochrome">Monochrome</option>
              <option value="place-value">Place Value</option>
              <option value="alternating">Alternating</option>
              <option value="heaven-earth">Heaven/Earth</option>
            </select>
          </label>
        </div>

        <div>
          <label>
            Color Palette:
            <select
              value={colorPalette}
              onChange={(e) => setColorPalette(e.target.value as any)}
              style={{ marginLeft: '5px' }}
            >
              <option value="default">Default</option>
              <option value="colorblind">Colorblind</option>
              <option value="mnemonic">Mnemonic</option>
              <option value="grayscale">Grayscale</option>
              <option value="nature">Nature</option>
            </select>
          </label>
        </div>

        <div>
          <label>
            Scale:
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={scaleFactor}
              onChange={(e) => setScaleFactor(parseFloat(e.target.value))}
              style={{ marginLeft: '5px' }}
            />
            {scaleFactor}x
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>
          <input
            type="checkbox"
            checked={animated}
            onChange={(e) => setAnimated(e.target.checked)}
          />
          Animated
        </label>

        <label style={{ marginLeft: '15px' }}>
          <input
            type="checkbox"
            checked={draggable}
            onChange={(e) => setDraggable(e.target.checked)}
          />
          Draggable
        </label>

        <label style={{ marginLeft: '15px' }}>
          <input
            type="checkbox"
            checked={hideInactive}
            onChange={(e) => setHideInactive(e.target.checked)}
          />
          Hide Inactive Beads
        </label>

        <label style={{ marginLeft: '15px' }}>
          <input
            type="checkbox"
            checked={showEmpty}
            onChange={(e) => setShowEmpty(e.target.checked)}
          />
          Show Empty Columns
        </label>
      </div>

      {/* Component info */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <strong>Component Dimensions:</strong> {dimensions.width.toFixed(1)} × {dimensions.height.toFixed(1)}px
        <br />
        <strong>Rod Spacing:</strong> {dimensions.rodSpacing.toFixed(1)}px
        <br />
        <strong>Bead Size:</strong> {dimensions.beadSize.toFixed(1)}px
        <br />
        <strong>Current Value:</strong> {demoValue}
        <br />
        <strong>Effective Columns:</strong> {actualColumns}
      </div>

      {/* Main Abacus Component */}
      <div style={{
        border: '2px solid #ddd',
        borderRadius: '10px',
        padding: '20px',
        display: 'inline-block',
        backgroundColor: '#fafafa'
      }}>
        <AbacusReact
          value={demoValue}
          columns={demoColumns}
          showEmptyColumns={showEmpty}
          hideInactiveBeads={hideInactive}
          beadShape={beadShape}
          colorScheme={colorScheme}
          colorPalette={colorPalette}
          scaleFactor={scaleFactor}
          animated={animated}
          draggable={draggable}
          onClick={handleBeadClick}
          onValueChange={handleValueChange}
        />
      </div>

      {/* Usage Examples */}
      <div style={{ marginTop: '40px' }}>
        <h2>Usage Examples</h2>

        <h3>Basic Usage</h3>
        <pre style={{ backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
{`import { AbacusReact } from './AbacusReact';

<AbacusReact value={123} />`}
        </pre>

        <h3>With Hooks</h3>
        <pre style={{ backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
{`import { AbacusReact, useAbacusState, useAbacusDimensions } from './AbacusReact';

function MyComponent() {
  const { value, setValue, toggleBead } = useAbacusState(0);
  const dimensions = useAbacusDimensions(3, 1.2);

  return (
    <div style={{ width: dimensions.width, height: dimensions.height }}>
      <AbacusReact
        value={value}
        columns={3}
        animated={true}
        draggable={true}
        onValueChange={setValue}
        onClick={(bead) => toggleBead(bead, 3)}
      />
    </div>
  );
}`}
        </pre>

        <h3>Advanced Configuration</h3>
        <pre style={{ backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '5px' }}>
{`<AbacusReact
  value={12345}
  columns={5}
  beadShape="diamond"
  colorScheme="place-value"
  colorPalette="colorblind"
  scaleFactor={1.5}
  animated={true}
  draggable={true}
  hideInactiveBeads={false}
  showEmptyColumns={true}
  onClick={(bead) => console.log('Clicked:', bead)}
  onValueChange={(newValue) => console.log('New value:', newValue)}
/>`}
        </pre>
      </div>

      {/* Quick Test Buttons */}
      <div style={{ marginTop: '20px' }}>
        <h3>Quick Tests</h3>
        <button onClick={() => setDemoValue(0)} style={{ margin: '0 5px', padding: '5px 10px' }}>
          Zero
        </button>
        <button onClick={() => setDemoValue(5)} style={{ margin: '0 5px', padding: '5px 10px' }}>
          Five
        </button>
        <button onClick={() => setDemoValue(9)} style={{ margin: '0 5px', padding: '5px 10px' }}>
          Nine
        </button>
        <button onClick={() => setDemoValue(123)} style={{ margin: '0 5px', padding: '5px 10px' }}>
          123
        </button>
        <button onClick={() => setDemoValue(5555)} style={{ margin: '0 5px', padding: '5px 10px' }}>
          5555
        </button>
        <button onClick={() => setDemoValue(Math.floor(Math.random() * 10000))} style={{ margin: '0 5px', padding: '5px 10px' }}>
          Random
        </button>
      </div>
    </div>
  );
};

export default AbacusExample;