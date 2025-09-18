import React, { useState, useCallback } from 'react';
import { AbacusReact, useAbacusDimensions, BeadConfig } from './AbacusReact';

// Gallery configuration mapping from the original examples
const GALLERY_EXAMPLES = [
  {
    id: 'basic-5',
    title: 'Basic Number 5',
    subtitle: 'Simple representation of 5',
    value: 5,
    config: {
      columns: 1,
      beadShape: 'diamond' as const,
      colorScheme: 'monochrome' as const,
      scaleFactor: 1,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'colorful-123',
    title: 'Colorful 123',
    subtitle: 'Multi-column with place value colors',
    value: 123,
    config: {
      columns: 3,
      beadShape: 'diamond' as const,
      colorScheme: 'place-value' as const,
      colorPalette: 'default' as const,
      scaleFactor: 1,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'circles-42',
    title: 'Circle Beads - 42',
    subtitle: 'Different bead shape demonstration',
    value: 42,
    config: {
      columns: 2,
      beadShape: 'circle' as const,
      colorScheme: 'place-value' as const,
      colorPalette: 'default' as const,
      scaleFactor: 1.2,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'large-7',
    title: 'Large Scale - 7',
    subtitle: 'Larger scale for better visibility',
    value: 7,
    config: {
      columns: 1,
      beadShape: 'diamond' as const,
      colorScheme: 'place-value' as const,
      colorPalette: 'default' as const,
      scaleFactor: 2,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'compact-999',
    title: 'Compact 999',
    subtitle: 'Square beads with alternating colors',
    value: 999,
    config: {
      columns: 3,
      beadShape: 'square' as const,
      colorScheme: 'alternating' as const,
      scaleFactor: 0.8,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'educational-1234',
    title: 'Educational 1234',
    subtitle: 'Four-digit educational example',
    value: 1234,
    config: {
      columns: 4,
      beadShape: 'circle' as const,
      colorScheme: 'place-value' as const,
      colorPalette: 'mnemonic' as const,
      scaleFactor: 0.9,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'crop-single-1',
    title: 'Single Digit',
    subtitle: 'Minimal single column design',
    value: 1,
    config: {
      columns: 1,
      beadShape: 'diamond' as const,
      colorScheme: 'monochrome' as const,
      scaleFactor: 0.8,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'crop-quad-9999',
    title: 'Four 9s',
    subtitle: 'Maximum value demonstration',
    value: 9999,
    config: {
      columns: 4,
      beadShape: 'diamond' as const,
      colorScheme: 'place-value' as const,
      colorPalette: 'colorblind' as const,
      scaleFactor: 0.9,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'crop-large-scale-0',
    title: 'Large Zero',
    subtitle: 'Empty abacus representation',
    value: 0,
    config: {
      columns: 1,
      beadShape: 'circle' as const,
      colorScheme: 'monochrome' as const,
      scaleFactor: 2,
      hideInactiveBeads: false,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'crop-hidden-inactive-555',
    title: 'Hidden Inactive',
    subtitle: 'Clean look with hidden inactive beads',
    value: 555,
    config: {
      columns: 3,
      beadShape: 'diamond' as const,
      colorScheme: 'place-value' as const,
      colorPalette: 'nature' as const,
      hideInactiveBeads: true,
      scaleFactor: 1.4,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'crop-mixed-geometry-321',
    title: 'Mixed Geometry',
    subtitle: 'Demonstrating various configurations',
    value: 321,
    config: {
      columns: 3,
      beadShape: 'circle' as const,
      colorScheme: 'place-value' as const,
      colorPalette: 'colorblind' as const,
      scaleFactor: 1.1,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'debug-89',
    title: 'Debug: 89',
    subtitle: 'Two-digit debugging example',
    value: 89,
    config: {
      columns: 2,
      beadShape: 'diamond' as const,
      colorScheme: 'place-value' as const,
      colorPalette: 'default' as const,
      scaleFactor: 1,
      animated: true,
      gestures: true
    }
  },
  {
    id: 'debug-456',
    title: 'Debug: 456',
    subtitle: 'Three-digit debugging example',
    value: 456,
    config: {
      columns: 3,
      beadShape: 'circle' as const,
      colorScheme: 'place-value' as const,
      colorPalette: 'default' as const,
      scaleFactor: 0.8,
      animated: true,
      gestures: true
    }
  }
];

interface InteractiveAbacusCardProps {
  example: typeof GALLERY_EXAMPLES[0];
  onValueChange?: (newValue: number) => void;
  onBeadClick?: (bead: BeadConfig) => void;
}

const InteractiveAbacusCard: React.FC<InteractiveAbacusCardProps> = ({
  example,
  onValueChange,
  onBeadClick
}) => {
  const [currentValue, setCurrentValue] = useState(example.value);
  const [clickCount, setClickCount] = useState(0);

  const dimensions = useAbacusDimensions(
    example.config.columns === 'auto' ? Math.max(1, currentValue.toString().length) : example.config.columns,
    example.config.scaleFactor || 1
  );

  const handleValueChange = useCallback((newValue: number) => {
    setCurrentValue(newValue);
    onValueChange?.(newValue);
  }, [onValueChange]);

  const handleBeadClick = useCallback((bead: BeadConfig) => {
    setClickCount(prev => prev + 1);
    onBeadClick?.(bead);
  }, [onBeadClick]);

  const resetValue = useCallback(() => {
    setCurrentValue(example.value);
    setClickCount(0);
  }, [example.value]);

  return (
    <div className="gallery-card">
      <div className="card-header">
        <div className="card-title">
          <h3>{example.title}</h3>
          <p>{example.subtitle}</p>
        </div>
        <div className="card-controls">
          <div className="value-display">
            Value: <strong>{currentValue}</strong>
          </div>
          <div className="interaction-stats">
            Clicks: <strong>{clickCount}</strong>
          </div>
          <button className="reset-btn" onClick={resetValue} title="Reset to original value">
            ↻
          </button>
        </div>
      </div>

      <div className="card-content">
        <div
          className="abacus-container"
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            margin: '0 auto'
          }}
        >
          <AbacusReact
            value={currentValue}
            {...example.config}
            onClick={handleBeadClick}
            onValueChange={handleValueChange}
          />
        </div>
      </div>

      <div className="card-footer">
        <div className="config-info">
          <span className="config-tag">{example.config.beadShape}</span>
          <span className="config-tag">{example.config.colorScheme}</span>
          <span className="config-tag">×{example.config.scaleFactor}</span>
        </div>
      </div>
    </div>
  );
};

const InteractiveGallery: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState('basic');
  const [globalStats, setGlobalStats] = useState({
    totalClicks: 0,
    totalValueChanges: 0,
    activeExample: null as string | null
  });

  const categorizedExamples = {
    basic: GALLERY_EXAMPLES.filter(ex =>
      ['basic-5', 'colorful-123', 'circles-42', 'large-7'].includes(ex.id)
    ),
    advanced: GALLERY_EXAMPLES.filter(ex =>
      ['compact-999', 'educational-1234', 'crop-hidden-inactive-555', 'crop-mixed-geometry-321'].includes(ex.id)
    ),
    debug: GALLERY_EXAMPLES.filter(ex =>
      ['crop-single-1', 'crop-quad-9999', 'crop-large-scale-0', 'debug-89', 'debug-456'].includes(ex.id)
    )
  };

  const handleGlobalValueChange = useCallback((newValue: number) => {
    setGlobalStats(prev => ({
      ...prev,
      totalValueChanges: prev.totalValueChanges + 1
    }));
  }, []);

  const handleGlobalBeadClick = useCallback((bead: BeadConfig) => {
    setGlobalStats(prev => ({
      ...prev,
      totalClicks: prev.totalClicks + 1
    }));
  }, []);

  const currentExamples = categorizedExamples[selectedTab as keyof typeof categorizedExamples];

  return (
    <div className="interactive-gallery">
      <style>{`
        .interactive-gallery {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          background: #f5f5f5;
          padding: 20px;
          min-height: 100vh;
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
        }

        .header {
          text-align: center;
          margin-bottom: 40px;
          padding: 40px 20px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .header h1 {
          font-size: 2.5rem;
          margin-bottom: 10px;
          color: #2c3e50;
        }

        .header p {
          font-size: 1.1rem;
          color: #666;
          margin-bottom: 20px;
        }

        .stats {
          background: white;
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 30px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          text-align: center;
        }

        .stats-info {
          color: #666;
          font-size: 0.9rem;
        }

        .global-stats {
          display: flex;
          justify-content: center;
          gap: 30px;
          margin-top: 10px;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .tabs {
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          overflow: hidden;
          margin-bottom: 30px;
        }

        .tab-nav {
          display: flex;
          border-bottom: 1px solid #eee;
        }

        .tab-button {
          flex: 1;
          padding: 20px;
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.1rem;
          font-weight: 600;
          color: #666;
          transition: all 0.3s;
          position: relative;
        }

        .tab-button:hover {
          background: #f8f9fa;
          color: #333;
        }

        .tab-button.active {
          color: #2c3e50;
          background: #f8f9fa;
        }

        .tab-button.active::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: #3498db;
        }

        .gallery-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 30px;
          padding: 30px;
        }

        .gallery-card {
          background: white;
          border-radius: 12px;
          box-shadow: 0 4px 15px rgba(0,0,0,0.1);
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .gallery-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        }

        .card-header {
          padding: 20px;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .card-title h3 {
          margin: 0 0 5px 0;
          color: #2c3e50;
          font-size: 1.3rem;
        }

        .card-title p {
          margin: 0;
          color: #666;
          font-size: 0.9rem;
        }

        .card-controls {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 5px;
        }

        .value-display, .interaction-stats {
          font-size: 0.85rem;
          color: #666;
        }

        .reset-btn {
          background: #3498db;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 5px 10px;
          cursor: pointer;
          font-size: 1.2rem;
          transition: background 0.2s;
        }

        .reset-btn:hover {
          background: #2980b9;
        }

        .card-content {
          padding: 30px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 200px;
          background: #fafafa;
        }

        .abacus-container {
          border: 2px solid rgba(0,0,0,0.1);
          border-radius: 8px;
          background: white;
          padding: 10px;
        }

        .card-footer {
          padding: 15px 20px;
          background: #f8f9fa;
          border-top: 1px solid #eee;
        }

        .config-info {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .config-tag {
          background: #e9ecef;
          color: #495057;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        .tutorial-box {
          background: #e8f4fd;
          border: 1px solid #bee5eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          text-align: center;
        }

        .tutorial-box h3 {
          color: #0c5460;
          margin-bottom: 10px;
        }

        .tutorial-box p {
          color: #0c5460;
          margin: 0;
        }

        @media (max-width: 768px) {
          .gallery-grid {
            grid-template-columns: 1fr;
            padding: 20px;
          }

          .card-header {
            flex-direction: column;
            align-items: stretch;
            gap: 15px;
          }

          .card-controls {
            flex-direction: row;
            justify-content: space-between;
            align-items: center;
          }
        }
      `}</style>

      <div className="container">
        <div className="header">
          <h1>🧮 Interactive Soroban Gallery</h1>
          <p>Click or drag the beads in natural directions to explore how a Japanese abacus works!</p>

          <div className="global-stats">
            <div className="stat-item">
              <span>Total Interactions:</span>
              <strong>{globalStats.totalClicks}</strong>
            </div>
            <div className="stat-item">
              <span>Value Changes:</span>
              <strong>{globalStats.totalValueChanges}</strong>
            </div>
          </div>
        </div>

        <div className="stats">
          <div className="stats-info">
            <strong>{GALLERY_EXAMPLES.length}</strong> interactive examples
            • All abaci are fully interactive with click and directional gesture support
            • Generated with React + TypeScript
          </div>
        </div>

        <div className="tutorial-box">
          <h3>🎯 How to Interact</h3>
          <p>
            <strong>Click</strong> beads to toggle their positions • <strong>Drag</strong> beads toward/away from the center bar •
            <strong>Reset</strong> button restores original values • Each interaction updates the value in real-time
          </p>
        </div>

        <div className="tabs">
          <div className="tab-nav">
            <button
              className={`tab-button ${selectedTab === 'basic' ? 'active' : ''}`}
              onClick={() => setSelectedTab('basic')}
            >
              📚 Basic Examples
            </button>
            <button
              className={`tab-button ${selectedTab === 'advanced' ? 'active' : ''}`}
              onClick={() => setSelectedTab('advanced')}
            >
              🎨 Advanced Features
            </button>
            <button
              className={`tab-button ${selectedTab === 'debug' ? 'active' : ''}`}
              onClick={() => setSelectedTab('debug')}
            >
              🔧 Debug & Edge Cases
            </button>
          </div>

          <div className="gallery-grid">
            {currentExamples.map((example) => (
              <InteractiveAbacusCard
                key={example.id}
                example={example}
                onValueChange={handleGlobalValueChange}
                onBeadClick={handleGlobalBeadClick}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveGallery;