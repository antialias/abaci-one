import type { ReactNode } from 'react'
import { css } from '../../../../../styled-system/css'

export interface GameRuleCardProps {
  title: string
  description: string
  enabled: boolean
  onClick: () => void
  dataAttribute?: string
  children?: ReactNode
}

export function GameRuleCard({
  title,
  description,
  enabled,
  onClick,
  dataAttribute,
  children,
}: GameRuleCardProps) {
  return (
    <div
      data-setting={dataAttribute}
      onClick={onClick}
      className={css({
        display: 'flex',
        flexDirection: children ? 'column' : 'row',
        gap: children ? '1vh' : undefined,
        justifyContent: children ? undefined : 'space-between',
        alignItems: children ? undefined : 'center',
        p: '1.5vh',
        bg: enabled ? 'rgba(251, 191, 36, 0.25)' : 'rgba(139, 92, 246, 0.1)',
        borderRadius: '1vh',
        border: '0.3vh solid',
        borderColor: enabled ? 'rgba(251, 191, 36, 0.8)' : 'rgba(139, 92, 246, 0.3)',
        transition: 'all 0.3s ease',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: enabled
          ? '0 0.5vh 2vh rgba(251, 191, 36, 0.4)'
          : '0 0.2vh 0.5vh rgba(0,0,0,0.1)',
        _hover: {
          bg: enabled ? 'rgba(251, 191, 36, 0.35)' : 'rgba(139, 92, 246, 0.2)',
          borderColor: enabled ? 'rgba(251, 191, 36, 1)' : 'rgba(139, 92, 246, 0.5)',
          transform: 'translateY(-0.2vh)',
        },
        _active: {
          transform: 'scale(0.98)',
        },
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flex: children ? undefined : 1,
        })}
      >
        <div className={css({ flex: 1, pointerEvents: 'none' })}>
          <div
            className={css({
              fontWeight: 'bold',
              fontSize: '1.6vh',
              color: enabled ? '#92400e' : '#7c2d12',
            })}
          >
            {enabled && '✓ '}
            {title}
          </div>
          <div className={css({ fontSize: '1.3vh', color: '#78350f' })}>{description}</div>
        </div>
        {enabled && (
          <div
            className={css({
              position: 'absolute',
              top: 0,
              right: 0,
              width: '4vh',
              height: '4vh',
              borderRadius: '0 1vh 0 100%',
              bg: 'rgba(251, 191, 36, 0.4)',
              pointerEvents: 'none',
            })}
          />
        )}
      </div>

      {children}
    </div>
  )
}
