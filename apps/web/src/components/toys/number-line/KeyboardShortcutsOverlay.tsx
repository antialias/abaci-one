interface KeyboardShortcutsOverlayProps {
  isDark: boolean
  showRefineMode: boolean
  onClose: () => void
}

export function KeyboardShortcutsOverlay({
  isDark,
  showRefineMode,
  onClose,
}: KeyboardShortcutsOverlayProps) {
  return (
    <div
      data-element="keyboard-shortcuts-overlay"
      onClick={onClose}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        data-element="keyboard-shortcuts-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          color: isDark ? '#e2e8f0' : '#1e293b',
          borderRadius: 12,
          padding: '20px 28px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          maxWidth: 360,
          width: '90%',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <span style={{ fontWeight: 700, fontSize: 16 }}>Keyboard Shortcuts</span>
          <button
            data-action="close-shortcuts"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: isDark ? '#94a3b8' : '#64748b',
              fontSize: 20,
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            &times;
          </button>
        </div>
        {(
          [
            ['Space', 'Play / pause'],
            ['\u2190 / \u2192', 'Scrub \u00b15%'],
            ['Shift + \u2190 / \u2192', 'Fine scrub \u00b12%'],
            ['J / L', 'Scrub \u00b110%'],
            ['< / >', 'Playback speed'],
            ['Home / End', 'Jump to start / end'],
            ...(showRefineMode ? [['R', 'Refine mode'] as const] : []),
            ['?', 'Toggle this help'],
            ['Esc', 'Close'],
          ] as const
        ).map(([key, desc]) => (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '5px 0',
            }}
          >
            <kbd
              style={{
                backgroundColor: isDark ? '#334155' : '#f1f5f9',
                color: isDark ? '#e2e8f0' : '#334155',
                borderRadius: 4,
                padding: '2px 8px',
                fontSize: 12,
                fontFamily: 'system-ui, sans-serif',
                fontWeight: 600,
                border: `1px solid ${isDark ? '#475569' : '#cbd5e1'}`,
                whiteSpace: 'nowrap',
              }}
            >
              {key}
            </kbd>
            <span
              style={{
                fontSize: 13,
                color: isDark ? '#94a3b8' : '#64748b',
                marginLeft: 12,
              }}
            >
              {desc}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
