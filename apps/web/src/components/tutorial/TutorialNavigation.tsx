import { css } from '../../../styled-system/css'
import { hstack } from '../../../styled-system/patterns'

interface NavigationState {
  canGoPrevious: boolean
  canGoNext: boolean
  totalSteps: number
}

interface TutorialNavigationProps {
  currentStepIndex: number
  navigationState: NavigationState
  isStepCompleted: boolean
  onPrevious: () => void
  onNext: () => void
}

export function TutorialNavigation({
  currentStepIndex,
  navigationState,
  isStepCompleted,
  onPrevious,
  onNext
}: TutorialNavigationProps) {
  return (
    <div className={css({
      borderTop: '1px solid',
      borderColor: 'gray.200',
      p: 4,
      bg: 'gray.50'
    })}>
      <div className={hstack({ justifyContent: 'space-between' })}>
        <button
          onClick={onPrevious}
          disabled={!navigationState.canGoPrevious}
          className={css({
            px: 4,
            py: 2,
            border: '1px solid',
            borderColor: 'gray.300',
            borderRadius: 'md',
            bg: 'white',
            cursor: navigationState.canGoPrevious ? 'pointer' : 'not-allowed',
            opacity: navigationState.canGoPrevious ? 1 : 0.5,
            _hover: navigationState.canGoPrevious ? { bg: 'gray.50' } : {}
          })}
        >
          ← Previous
        </button>

        <div className={css({ fontSize: 'sm', color: 'gray.600' })}>
          Step {currentStepIndex + 1} of {navigationState.totalSteps}
        </div>

        <button
          onClick={onNext}
          disabled={!navigationState.canGoNext && !isStepCompleted}
          className={css({
            px: 4,
            py: 2,
            border: '1px solid',
            borderColor: navigationState.canGoNext || isStepCompleted ? 'blue.300' : 'gray.300',
            borderRadius: 'md',
            bg: navigationState.canGoNext || isStepCompleted ? 'blue.500' : 'gray.200',
            color: navigationState.canGoNext || isStepCompleted ? 'white' : 'gray.500',
            cursor: navigationState.canGoNext || isStepCompleted ? 'pointer' : 'not-allowed',
            _hover: navigationState.canGoNext || isStepCompleted ? { bg: 'blue.600' } : {}
          })}
        >
          {navigationState.canGoNext ? 'Next →' : 'Complete Tutorial'}
        </button>
      </div>
    </div>
  )
}