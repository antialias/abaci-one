import { css } from '../../../../../styled-system/css'

export interface SetupHeaderProps {
  onOpenGuide: () => void
}

export function SetupHeader({ onOpenGuide }: SetupHeaderProps) {
  return (
    <div
      data-element="title-section"
      className={css({
        textAlign: 'center',
        bg: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '1.5vh',
        p: '1.5vh',
        boxShadow: '0 1vh 3vh rgba(0,0,0,0.5)',
        width: '100%',
        position: 'relative',
        border: '0.3vh solid',
        borderColor: 'rgba(251, 191, 36, 0.6)',
        backdropFilter: 'blur(10px)',
        flexShrink: 0,
      })}
    >
      {/* Ornamental corners */}
      <div
        className={css({
          position: 'absolute',
          top: '-0.5vh',
          left: '-0.5vh',
          width: '2.5vh',
          height: '2.5vh',
          borderTop: '0.3vh solid',
          borderLeft: '0.3vh solid',
          borderColor: 'rgba(251, 191, 36, 0.8)',
          borderRadius: '1.5vh 0 0 0',
        })}
      />
      <div
        className={css({
          position: 'absolute',
          top: '-0.5vh',
          right: '-0.5vh',
          width: '2.5vh',
          height: '2.5vh',
          borderTop: '0.3vh solid',
          borderRight: '0.3vh solid',
          borderColor: 'rgba(251, 191, 36, 0.8)',
          borderRadius: '0 1.5vh 0 0',
        })}
      />
      <div
        className={css({
          position: 'absolute',
          bottom: '-0.5vh',
          left: '-0.5vh',
          width: '2.5vh',
          height: '2.5vh',
          borderBottom: '0.3vh solid',
          borderLeft: '0.3vh solid',
          borderColor: 'rgba(251, 191, 36, 0.8)',
          borderRadius: '0 0 0 1.5vh',
        })}
      />
      <div
        className={css({
          position: 'absolute',
          bottom: '-0.5vh',
          right: '-0.5vh',
          width: '2.5vh',
          height: '2.5vh',
          borderBottom: '0.3vh solid',
          borderRight: '0.3vh solid',
          borderColor: 'rgba(251, 191, 36, 0.8)',
          borderRadius: '0 0 1.5vh 0',
        })}
      />

      <h1
        className={css({
          fontSize: '3.5vh',
          fontWeight: 'bold',
          mb: '0.5vh',
          color: '#7c2d12',
          textShadow: '0.15vh 0.15vh 0 rgba(251, 191, 36, 0.5), 0.3vh 0.3vh 0.5vh rgba(0,0,0,0.3)',
          letterSpacing: '0.2vh',
        })}
      >
        ⚔️ RITHMOMACHIA ⚔️
      </h1>
      <div
        className={css({
          height: '0.2vh',
          width: '60%',
          margin: '0 auto 0.5vh',
          background: 'linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.8), transparent)',
        })}
      />
      <p
        className={css({
          color: '#92400e',
          fontSize: '1.8vh',
          fontWeight: 'bold',
          mb: '0.3vh',
          fontStyle: 'italic',
        })}
      >
        The Philosopher's Game
      </p>
      <p
        className={css({
          color: '#78350f',
          fontSize: '1.2vh',
          lineHeight: '1.4',
          fontWeight: '500',
          mb: '0.8vh',
        })}
      >
        Win by forming mathematical progressions in enemy territory
      </p>
      <button
        type="button"
        data-action="open-guide"
        onClick={onOpenGuide}
        className={css({
          bg: 'linear-gradient(135deg, #7c2d12, #92400e)',
          color: 'white',
          border: '2px solid rgba(251, 191, 36, 0.6)',
          borderRadius: '0.8vh',
          px: '1.5vh',
          py: '0.8vh',
          fontSize: '1.3vh',
          fontWeight: 'bold',
          cursor: 'pointer',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5vh',
          mx: 'auto',
          boxShadow: '0 0.3vh 0.8vh rgba(0, 0, 0, 0.3)',
          _hover: {
            bg: 'linear-gradient(135deg, #92400e, #7c2d12)',
            transform: 'translateY(-0.2vh)',
            boxShadow: '0 0.5vh 1.2vh rgba(0, 0, 0, 0.4)',
          },
        })}
      >
        <span>📖</span>
        <span>How to Play</span>
      </button>
    </div>
  )
}
