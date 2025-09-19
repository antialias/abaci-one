'use client';

import { useState, useCallback } from 'react';

interface TypstConfig {
  number: number;
  bead_shape: 'diamond' | 'circle' | 'square';
  color_scheme: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating';
  color_palette: 'default' | 'colorblind' | 'mnemonic' | 'grayscale' | 'nature';
  base_size: number;
  columns: number | 'auto';
  show_empty: boolean;
  hide_inactive: boolean;
}

const defaultConfig: TypstConfig = {
  number: 123,
  bead_shape: 'diamond',
  color_scheme: 'place-value',
  color_palette: 'default',
  base_size: 1.0,
  columns: 'auto',
  show_empty: false,
  hide_inactive: false,
};

const presets: Record<string, Partial<TypstConfig>> = {
  'Classic': { bead_shape: 'diamond', color_scheme: 'monochrome', base_size: 1.0 },
  'Colorful': { bead_shape: 'circle', color_scheme: 'place-value', color_palette: 'default', base_size: 1.2 },
  'Educational': { bead_shape: 'circle', color_scheme: 'heaven-earth', show_empty: true, base_size: 1.5 },
  'Minimal': { bead_shape: 'square', color_scheme: 'monochrome', hide_inactive: true, base_size: 0.8 },
  'Accessible': { bead_shape: 'circle', color_scheme: 'place-value', color_palette: 'colorblind', base_size: 1.3 },
};

export default function TypstPlayground() {
  const [config, setConfig] = useState<TypstConfig>(defaultConfig);
  const [svg, setSvg] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastGenerated, setLastGenerated] = useState<string>('');

  const generateSvg = useCallback(async (currentConfig: TypstConfig) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/typst-svg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(currentConfig),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setSvg(data.svg);
      setLastGenerated(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Error generating SVG:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = (key: keyof TypstConfig, value: any) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    // Auto-generate on config change (debounced)
    setTimeout(() => generateSvg(newConfig), 500);
  };

  const applyPreset = (presetName: string) => {
    const newConfig = { ...config, ...presets[presetName] };
    setConfig(newConfig);
    generateSvg(newConfig);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🛠️ Soroban Template Playground
          </h1>
          <p className="text-lg text-gray-600">
            Interactive tool for testing soroban template configurations in real-time
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Configuration Panel */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-8">
              <h2 className="text-xl font-semibold mb-6">Configuration</h2>

              {/* Presets */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Quick Presets
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.keys(presets).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => applyPreset(preset)}
                      className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Number Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number
                </label>
                <input
                  type="number"
                  value={config.number}
                  onChange={(e) => updateConfig('number', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="99999"
                />
              </div>

              {/* Bead Shape */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bead Shape
                </label>
                <select
                  value={config.bead_shape}
                  onChange={(e) => updateConfig('bead_shape', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="diamond">Diamond</option>
                  <option value="circle">Circle</option>
                  <option value="square">Square</option>
                </select>
              </div>

              {/* Color Scheme */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Scheme
                </label>
                <select
                  value={config.color_scheme}
                  onChange={(e) => updateConfig('color_scheme', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="monochrome">Monochrome</option>
                  <option value="place-value">Place Value</option>
                  <option value="heaven-earth">Heaven & Earth</option>
                  <option value="alternating">Alternating</option>
                </select>
              </div>

              {/* Color Palette */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color Palette
                </label>
                <select
                  value={config.color_palette}
                  onChange={(e) => updateConfig('color_palette', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="default">Default</option>
                  <option value="colorblind">Colorblind Friendly</option>
                  <option value="mnemonic">Mnemonic</option>
                  <option value="grayscale">Grayscale</option>
                  <option value="nature">Nature</option>
                </select>
              </div>

              {/* Base Size */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scale: {config.base_size}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="3.0"
                  step="0.1"
                  value={config.base_size}
                  onChange={(e) => updateConfig('base_size', parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Columns */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Columns
                </label>
                <select
                  value={config.columns}
                  onChange={(e) => updateConfig('columns', e.target.value === 'auto' ? 'auto' : parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="auto">Auto</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </div>

              {/* Toggles */}
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.show_empty}
                    onChange={(e) => updateConfig('show_empty', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Show empty columns</span>
                </label>
              </div>

              <div className="mb-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.hide_inactive}
                    onChange={(e) => updateConfig('hide_inactive', e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">Hide inactive beads</span>
                </label>
              </div>

              {/* Generate Button */}
              <button
                onClick={() => generateSvg(config)}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-3 px-4 rounded-md font-medium transition-colors"
              >
                {loading ? 'Generating...' : 'Generate Now'}
              </button>

              {lastGenerated && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Last updated: {lastGenerated}
                </p>
              )}
            </div>
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Live Preview</h2>
                <div className="text-sm text-gray-600">
                  Number: <code className="bg-gray-100 px-2 py-1 rounded">{config.number}</code>
                </div>
              </div>

              {/* Preview Area */}
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 min-h-[400px] flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
                {loading && (
                  <div className="text-center">
                    <div className="animate-spin text-4xl mb-4">🔄</div>
                    <div className="text-gray-600">Generating soroban...</div>
                  </div>
                )}

                {error && (
                  <div className="text-center text-red-600">
                    <div className="text-4xl mb-4">❌</div>
                    <div className="font-medium">Generation Error</div>
                    <div className="text-sm mt-2">{error}</div>
                  </div>
                )}

                {svg && !loading && (
                  <div
                    dangerouslySetInnerHTML={{ __html: svg }}
                    className="max-w-full max-h-full"
                  />
                )}

                {!svg && !loading && !error && (
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-4">🧮</div>
                    <div className="font-medium">Configure and Generate</div>
                    <div className="text-sm mt-2">Adjust settings and click generate to see your soroban</div>
                  </div>
                )}
              </div>

              {/* Configuration Summary */}
              {svg && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Current Configuration</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Shape:</span>{' '}
                      <span className="font-mono">{config.bead_shape}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Colors:</span>{' '}
                      <span className="font-mono">{config.color_scheme}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Scale:</span>{' '}
                      <span className="font-mono">{config.base_size}x</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Columns:</span>{' '}
                      <span className="font-mono">{config.columns}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}