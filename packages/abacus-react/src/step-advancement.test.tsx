import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { render, fireEvent, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Mock the instruction generator
const generateAbacusInstructions = (startValue: number, targetValue: number) => {
  // Mock implementation for 3+14=17 case
  if (startValue === 3 && targetValue === 8) {
    return {
      stepBeadHighlights: [{
        placeValue: 0,
        beadType: 'heaven' as const,
        stepIndex: 0,
        direction: 'activate' as const,
        order: 0
      }]
    };
  }

  if (startValue === 8 && targetValue === 18) {
    return {
      stepBeadHighlights: [{
        placeValue: 1,
        beadType: 'earth' as const,
        position: 0,
        stepIndex: 0,
        direction: 'activate' as const,
        order: 0
      }]
    };
  }

  if (startValue === 18 && targetValue === 17) {
    return {
      stepBeadHighlights: [{
        placeValue: 0,
        beadType: 'earth' as const,
        position: 0,
        stepIndex: 0,
        direction: 'deactivate' as const,
        order: 0
      }]
    };
  }

  return { stepBeadHighlights: [] };
};

// Test component that implements the step advancement logic
const StepAdvancementTest: React.FC = () => {
  const [currentValue, setCurrentValue] = useState(3);
  const [currentMultiStep, setCurrentMultiStep] = useState(0);

  const lastValueForStepAdvancement = useRef<number>(currentValue);
  const userHasInteracted = useRef<boolean>(false);

  // Mock current step data (3 + 14 = 17)
  const currentStep = {
    startValue: 3,
    targetValue: 17,
    stepBeadHighlights: [
      {
        placeValue: 0,
        beadType: 'heaven' as const,
        stepIndex: 0,
        direction: 'activate' as const,
        order: 0
      },
      {
        placeValue: 1,
        beadType: 'earth' as const,
        position: 0,
        stepIndex: 1,
        direction: 'activate' as const,
        order: 0
      },
      {
        placeValue: 0,
        beadType: 'earth' as const,
        position: 0,
        stepIndex: 2,
        direction: 'deactivate' as const,
        order: 0
      }
    ],
    totalSteps: 3
  };

  // Define the static expected steps
  const expectedSteps = useMemo(() => {
    if (!currentStep.stepBeadHighlights || !currentStep.totalSteps || currentStep.totalSteps <= 1) {
      return [];
    }

    const stepIndices = [...new Set(currentStep.stepBeadHighlights.map(bead => bead.stepIndex))].sort();
    const steps = [];
    let value = currentStep.startValue;

    if (currentStep.startValue === 3 && currentStep.targetValue === 17) {
      const milestones = [8, 18, 17];
      for (let i = 0; i < stepIndices.length && i < milestones.length; i++) {
        steps.push({
          index: i,
          stepIndex: stepIndices[i],
          targetValue: milestones[i],
          startValue: value,
          description: `Step ${i + 1}`
        });
        value = milestones[i];
      }
    }

    console.log('📋 Generated expected steps:', steps);
    return steps;
  }, []);

  // Get arrows for immediate next action
  const getCurrentStepBeads = useCallback(() => {
    if (currentValue === currentStep.targetValue) return undefined;
    if (expectedSteps.length === 0) return currentStep.stepBeadHighlights;

    const currentExpectedStep = expectedSteps[currentMultiStep];
    if (!currentExpectedStep) return undefined;

    try {
      const instruction = generateAbacusInstructions(currentValue, currentExpectedStep.targetValue);
      const immediateAction = instruction.stepBeadHighlights?.filter(bead => bead.stepIndex === 0);

      console.log('🎯 Expected step progression:', {
        currentValue,
        expectedStepIndex: currentMultiStep,
        expectedStepTarget: currentExpectedStep.targetValue,
        expectedStepDescription: currentExpectedStep.description,
        immediateActionBeads: immediateAction?.length || 0,
        totalExpectedSteps: expectedSteps.length
      });

      return immediateAction && immediateAction.length > 0 ? immediateAction : undefined;
    } catch (error) {
      console.warn('⚠️ Failed to generate step guidance:', error);
      return undefined;
    }
  }, [currentValue, expectedSteps, currentMultiStep]);

  // Step advancement logic
  useEffect(() => {
    const valueChanged = currentValue !== lastValueForStepAdvancement.current;
    const currentExpectedStep = expectedSteps[currentMultiStep];

    console.log('🔍 Expected step advancement check:', {
      currentValue,
      lastValue: lastValueForStepAdvancement.current,
      valueChanged,
      userHasInteracted: userHasInteracted.current,
      expectedStepIndex: currentMultiStep,
      expectedStepTarget: currentExpectedStep?.targetValue,
      expectedStepReached: currentExpectedStep ? currentValue === currentExpectedStep.targetValue : false,
      totalExpectedSteps: expectedSteps.length,
      finalTargetReached: currentValue === currentStep?.targetValue
    });

    if (valueChanged && userHasInteracted.current && expectedSteps.length > 0 && currentExpectedStep) {
      if (currentValue === currentExpectedStep.targetValue) {
        const hasMoreExpectedSteps = currentMultiStep < expectedSteps.length - 1;

        console.log('🎯 Expected step completed:', {
          completedStep: currentMultiStep,
          targetReached: currentExpectedStep.targetValue,
          hasMoreSteps: hasMoreExpectedSteps,
          willAdvance: hasMoreExpectedSteps
        });

        if (hasMoreExpectedSteps) {
          const timeoutId = setTimeout(() => {
            console.log('⚡ Advancing to next expected step:', currentMultiStep, '→', currentMultiStep + 1);
            setCurrentMultiStep(prev => prev + 1);
            lastValueForStepAdvancement.current = currentValue;
          }, 100); // Shorter delay for testing

          return () => clearTimeout(timeoutId);
        }
      }
    }
  }, [currentValue, currentMultiStep, expectedSteps]);

  // Update reference when step changes
  useEffect(() => {
    lastValueForStepAdvancement.current = currentValue;
    userHasInteracted.current = false;
  }, [currentMultiStep]);

  const handleValueChange = (newValue: number) => {
    userHasInteracted.current = true;
    setCurrentValue(newValue);
  };

  const currentStepBeads = getCurrentStepBeads();

  return (
    <div data-testid="step-test">
      <div data-testid="current-value">{currentValue}</div>
      <div data-testid="expected-step-index">{currentMultiStep}</div>
      <div data-testid="expected-steps-length">{expectedSteps.length}</div>
      <div data-testid="current-expected-target">
        {expectedSteps[currentMultiStep]?.targetValue || 'N/A'}
      </div>
      <div data-testid="has-step-beads">{currentStepBeads ? 'yes' : 'no'}</div>

      <button
        data-testid="set-value-8"
        onClick={() => handleValueChange(8)}
      >
        Set Value to 8
      </button>
      <button
        data-testid="set-value-18"
        onClick={() => handleValueChange(18)}
      >
        Set Value to 18
      </button>
      <button
        data-testid="set-value-17"
        onClick={() => handleValueChange(17)}
      >
        Set Value to 17
      </button>

      <div data-testid="expected-steps">
        {JSON.stringify(expectedSteps)}
      </div>
    </div>
  );
};

// Test cases
describe('Step Advancement Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();
  });

  test('should generate expected steps for 3+14=17', () => {
    render(<StepAdvancementTest />);

    expect(screen.getByTestId('expected-steps-length')).toHaveTextContent('3');
    expect(screen.getByTestId('current-expected-target')).toHaveTextContent('8');
    expect(screen.getByTestId('expected-step-index')).toHaveTextContent('0');
  });

  test('should advance from step 0 to step 1 when reaching value 8', async () => {
    render(<StepAdvancementTest />);

    // Initial state
    expect(screen.getByTestId('current-value')).toHaveTextContent('3');
    expect(screen.getByTestId('expected-step-index')).toHaveTextContent('0');
    expect(screen.getByTestId('current-expected-target')).toHaveTextContent('8');

    // Click to set value to 8
    fireEvent.click(screen.getByTestId('set-value-8'));

    // Should still be step 0 immediately
    expect(screen.getByTestId('current-value')).toHaveTextContent('8');
    expect(screen.getByTestId('expected-step-index')).toHaveTextContent('0');

    // Wait for timeout to advance step
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should now be step 1
    expect(screen.getByTestId('expected-step-index')).toHaveTextContent('1');
    expect(screen.getByTestId('current-expected-target')).toHaveTextContent('18');
  });

  test('should advance through all steps', async () => {
    render(<StepAdvancementTest />);

    // Step 0 → 1 (3 → 8)
    fireEvent.click(screen.getByTestId('set-value-8'));
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(screen.getByTestId('expected-step-index')).toHaveTextContent('1');

    // Step 1 → 2 (8 → 18)
    fireEvent.click(screen.getByTestId('set-value-18'));
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(screen.getByTestId('expected-step-index')).toHaveTextContent('2');

    // Step 2 → complete (18 → 17)
    fireEvent.click(screen.getByTestId('set-value-17'));
    await new Promise(resolve => setTimeout(resolve, 150));
    // Should stay at step 2 since it's the last step
    expect(screen.getByTestId('expected-step-index')).toHaveTextContent('2');
  });
});

export default StepAdvancementTest;