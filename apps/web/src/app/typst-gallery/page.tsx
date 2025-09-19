'use client';

import { useState, useEffect } from 'react';

interface TemplateExample {
  id: string;
  title: string;
  description: string;
  number: number;
  config: {
    bead_shape?: 'diamond' | 'circle' | 'square';
    color_scheme?: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating';
    base_size?: number;
    columns?: number | 'auto';
    show_empty?: boolean;
    hide_inactive?: boolean;
  };
}

const examples: TemplateExample[] = [
  {
    id: 'basic-5',
    title: 'Basic Number 5',
    description: 'Simple representation of 5 with default settings',
    number: 5,
    config: {}
  },
  {
    id: 'diamond-123',
    title: 'Diamond Beads - 123',
    description: 'Number 123 with diamond beads and place-value colors',
    number: 123,
    config: {
      bead_shape: 'diamond',
      color_scheme: 'place-value',
      base_size: 1.2
    }
  },
  {
    id: 'circle-1234',
    title: 'Circle Beads - 1234',
    description: 'Larger number with circular beads and heaven-earth colors',
    number: 1234,
    config: {
      bead_shape: 'circle',
      color_scheme: 'heaven-earth',
      base_size: 1.0
    }
  },
  {
    id: 'large-scale-42',
    title: 'Large Scale - 42',
    description: 'Number 42 with larger scale for detail work',
    number: 42,
    config: {
      bead_shape: 'diamond',
      color_scheme: 'place-value',
      base_size: 2.0
    }
  },
  {
    id: 'minimal-999',
    title: 'Minimal - 999',
    description: 'Compact rendering with hidden inactive beads',
    number: 999,
    config: {
      bead_shape: 'square',
      color_scheme: 'monochrome',
      hide_inactive: true,
      base_size: 0.8
    }
  },
  {
    id: 'alternating-colors-567',
    title: 'Alternating Colors - 567',
    description: 'Mid-range number with alternating color scheme',
    number: 567,
    config: {
      bead_shape: 'circle',
      color_scheme: 'alternating',
      base_size: 1.5
    }
  }
];

export default function TypstGallery() {
  const [renderings, setRenderings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const generateSvg = async (example: TemplateExample) => {
    setLoading(prev => ({ ...prev, [example.id]: true }));
    setErrors(prev => ({ ...prev, [example.id]: '' }));

    try {
      const response = await fetch('/api/typst-svg', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: example.number,
          ...example.config
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRenderings(prev => ({ ...prev, [example.id]: data.svg }));
    } catch (error) {
      console.error('Error generating SVG:', error);
      setErrors(prev => ({
        ...prev,
        [example.id]: error instanceof Error ? error.message : 'Unknown error'
      }));
    } finally {
      setLoading(prev => ({ ...prev, [example.id]: false }));
    }
  };

  const generateAll = async () => {
    for (const example of examples) {
      await generateSvg(example);
      // Small delay between requests to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            🧮 Soroban Template Gallery
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Interactive preview of soroban template renderings with different configurations
          </p>
          <button
            onClick={generateAll}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            Generate All Examples
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {examples.map((example) => (
            <div key={example.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {example.title}
                    </h3>
                    <p className="text-gray-600 text-sm mb-4">
                      {example.description}
                    </p>
                  </div>
                  <button
                    onClick={() => generateSvg(example)}
                    disabled={loading[example.id]}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                  >
                    {loading[example.id] ? '🔄' : '🎨'}
                  </button>
                </div>

                {/* Configuration Details */}
                <div className="mb-4 p-3 bg-gray-50 rounded text-xs">
                  <div className="font-medium text-gray-700 mb-1">Configuration:</div>
                  <div className="text-gray-600">
                    <div>Number: <code>{example.number}</code></div>
                    {Object.entries(example.config).map(([key, value]) => (
                      <div key={key}>
                        {key}: <code>{String(value)}</code>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rendering Area */}
                <div className="border rounded-lg p-4 bg-gray-50 min-h-[200px] flex items-center justify-center">
                  {loading[example.id] && (
                    <div className="text-center">
                      <div className="animate-spin text-2xl mb-2">🔄</div>
                      <div className="text-gray-600">Generating...</div>
                    </div>
                  )}

                  {errors[example.id] && (
                    <div className="text-center text-red-600">
                      <div className="text-2xl mb-2">❌</div>
                      <div className="text-sm">{errors[example.id]}</div>
                    </div>
                  )}

                  {renderings[example.id] && !loading[example.id] && (
                    <div
                      dangerouslySetInnerHTML={{ __html: renderings[example.id] }}
                      className="max-w-full"
                    />
                  )}

                  {!loading[example.id] && !errors[example.id] && !renderings[example.id] && (
                    <div className="text-center text-gray-500">
                      <div className="text-2xl mb-2">🧮</div>
                      <div className="text-sm">Click generate to render</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-gray-600">
          <p>
            Powered by <strong>@soroban/templates</strong> and <strong>typst.ts</strong>
          </p>
          <p className="text-sm mt-2">
            This gallery helps visualize different template configurations before implementation
          </p>
        </div>
      </div>
    </div>
  );
}