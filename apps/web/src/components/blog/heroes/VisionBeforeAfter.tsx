'use client'

import { css } from '../../../../styled-system/css'
import { VerticalProblem } from '@/components/practice/VerticalProblem'

export default function VisionBeforeAfter() {
  return (
    <div
      className={css({
        display: 'flex',
        gap: '3rem',
        padding: '2rem',
        alignItems: 'flex-start',
        justifyContent: 'center',
        height: '100%',
      })}
    >
      {/* Without Vision - Left Side */}
      <div className={css({ textAlign: 'center' })}>
        <div
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'gray.600',
            marginBottom: '1rem',
          })}
        >
          Without Vision
        </div>
        <div
          className={css({
            padding: '1.5rem',
            backgroundColor: 'gray.50',
            borderRadius: '12px',
            border: '2px solid',
            borderColor: 'gray.200',
          })}
        >
          <VerticalProblem
            terms={[45, 32, 18]}
            userAnswer=""
            isFocused={true}
            isCompleted={false}
            correctAnswer={95}
            size="large"
          />
        </div>
        <div
          className={css({
            fontSize: '0.75rem',
            color: 'gray.500',
            marginTop: '0.75rem',
          })}
        >
          No feedback until answer is entered
        </div>
      </div>

      {/* With Vision - Right Side */}
      <div className={css({ textAlign: 'center' })}>
        <div
          className={css({
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'green.600',
            marginBottom: '1rem',
          })}
        >
          With Vision Detection
        </div>
        <div
          className={css({
            padding: '1.5rem',
            backgroundColor: 'green.50',
            borderRadius: '12px',
            border: '2px solid',
            borderColor: 'green.300',
          })}
        >
          <VerticalProblem
            terms={[45, 32, 18]}
            userAnswer="77"
            isFocused={true}
            isCompleted={false}
            correctAnswer={95}
            size="large"
            detectedPrefixIndex={1}
          />
        </div>
        <div
          className={css({
            fontSize: '0.75rem',
            color: 'green.600',
            marginTop: '0.75rem',
          })}
        >
          Real-time checkmarks as terms complete
        </div>
      </div>
    </div>
  )
}
