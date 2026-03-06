import { emojiForStride, lcm } from './lcmComboGenerator'

interface HoppingPartyBarProps {
  partyInvitees: number[]
  isDark: boolean
  onToggleInvite: (value: number) => void
  onStartParty: () => void
  onClearParty: () => void
}

export function HoppingPartyBar({
  partyInvitees,
  isDark,
  onToggleInvite,
  onStartParty,
  onClearParty,
}: HoppingPartyBarProps) {
  return (
    <div
      data-component="party-bar"
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderRadius: 12,
        background: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
        zIndex: 10,
        whiteSpace: 'nowrap',
      }}
    >
      {partyInvitees.map((stride) => (
        <button
          key={stride}
          data-action="remove-invitee"
          onClick={() => onToggleInvite(stride)}
          title={`Remove ${stride}`}
          style={{
            background: 'none',
            border: `2px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'}`,
            borderRadius: 8,
            padding: '2px 6px',
            cursor: 'pointer',
            fontSize: 14,
            color: isDark ? '#f3f4f6' : '#1f2937',
          }}
        >
          {emojiForStride(stride)} {stride}
        </button>
      ))}
      <span
        data-element="lcm-preview"
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: isDark ? '#a5b4fc' : '#4f46e5',
          marginLeft: 4,
        }}
      >
        LCM = {lcm(partyInvitees)}
      </span>
      {partyInvitees.length >= 2 && (
        <button
          data-action="start-party"
          onClick={onStartParty}
          style={{
            background: isDark ? '#4f46e5' : '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '4px 12px',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            marginLeft: 4,
          }}
        >
          Start Party!
        </button>
      )}
      <button
        data-action="clear-party"
        onClick={onClearParty}
        title="Clear all"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
          padding: '0 2px',
          marginLeft: 2,
        }}
      >
        ✕
      </button>
    </div>
  )
}
