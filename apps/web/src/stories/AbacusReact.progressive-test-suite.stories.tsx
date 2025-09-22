import type { Meta, StoryObj } from '@storybook/react';
import { AbacusReact, StepBeadHighlight } from '@soroban/abacus-react';
import React, { useState, useCallback } from 'react';
import { generateAbacusInstructions } from '../utils/abacusInstructionGenerator';

// Use the real instruction generator - much cleaner!
const getRealInstructions = (startValue: number, targetValue: number) => {
  console.log(`🔄 Generating REAL instructions: ${startValue} → ${targetValue}`);

  const realInstruction = generateAbacusInstructions(startValue, targetValue);

  return {
    stepBeadHighlights: realInstruction.stepBeadHighlights || [],
    totalSteps: realInstruction.totalSteps || 0,
    multiStepInstructions: realInstruction.multiStepInstructions || []
  };
};

// Reusable story component
const ProgressiveTestComponent: React.FC<{
  title: string;
  startValue: number;
  targetValue: number;
  columns?: number;
  description?: string;
}> = ({ title, startValue, targetValue, columns = 2, description }) => {
  const [currentValue, setCurrentValue] = useState(startValue);
  const [currentStep, setCurrentStep] = useState(0);

  const userHasInteracted = React.useRef<boolean>(false);
  const lastValueForStepAdvancement = React.useRef<number>(currentValue);

  // Generate expected steps from the real instruction generator
  const fullInstruction = React.useMemo(() => {
    return generateAbacusInstructions(startValue, targetValue);
  }, [startValue, targetValue]);

  const expectedSteps = React.useMemo(() => {
    if (!fullInstruction.stepBeadHighlights || !fullInstruction.multiStepInstructions) {
      return [];
    }

    // Extract unique step indices and create milestones by simulating bead movements
    const stepIndices = [...new Set(fullInstruction.stepBeadHighlights.map(bead => bead.stepIndex))].sort();
    const steps = [];
    let currentAbacusValue = startValue;

    stepIndices.forEach((stepIndex, i) => {
      const description = fullInstruction.multiStepInstructions?.[i] || `Step ${i + 1}`;
      const stepBeads = fullInstruction.stepBeadHighlights.filter(bead => bead.stepIndex === stepIndex);

      // Calculate the value change for this step by applying all bead movements
      let valueChange = 0;
      stepBeads.forEach(bead => {
        const placeMultiplier = Math.pow(10, bead.placeValue);

        if (bead.beadType === 'heaven') {
          // Heaven bead is worth 5 in its place value
          valueChange += bead.direction === 'activate' ? (5 * placeMultiplier) : -(5 * placeMultiplier);
        } else {
          // Earth bead is worth 1 in its place value
          valueChange += bead.direction === 'activate' ? placeMultiplier : -placeMultiplier;
        }
      });

      currentAbacusValue += valueChange;

      steps.push({
        index: i,
        targetValue: currentAbacusValue,
        description: description
      });
    });

    console.log('📋 Generated expected steps with calculated values:', steps);
    return steps;
  }, [fullInstruction, startValue]);

  const getCurrentStepBeads = useCallback(() => {
    if (currentValue === targetValue) return undefined;

    const currentExpectedStep = expectedSteps[currentStep];
    if (!currentExpectedStep) return undefined;

    // CRITICAL FIX: If we've already reached the current step's target, don't show arrows
    if (currentValue === currentExpectedStep.targetValue) {
      console.log('🎯 Current step completed, hiding arrows until step advances');
      return undefined;
    }

    try {
      // Generate arrows to get from current value to current expected step's target
      const dynamicInstruction = generateAbacusInstructions(currentValue, currentExpectedStep.targetValue);

      // CRITICAL FIX: Set all stepIndex to match currentStep for arrow display
      const adjustedStepBeads = dynamicInstruction.stepBeadHighlights?.map(bead => ({
        ...bead,
        stepIndex: currentStep // Force stepIndex to match currentStep
      }));

      console.log('🔄 Dynamic instruction:', {
        from: currentValue,
        to: currentExpectedStep.targetValue,
        expectedStepIndex: currentStep,
        expectedStepDescription: currentExpectedStep.description,
        originalStepBeads: dynamicInstruction.stepBeadHighlights,
        adjustedStepBeads: adjustedStepBeads,
        stepCount: adjustedStepBeads?.length || 0
      });
      return adjustedStepBeads;
    } catch (error) {
      console.error('Failed to generate dynamic instruction:', error);
      return undefined;
    }
  }, [currentValue, currentStep, expectedSteps, targetValue]);

  const currentStepBeads = getCurrentStepBeads();

  const handleValueChange = (newValue: number) => {
    console.log('👆 User clicked, value changed:', currentValue, '→', newValue);
    userHasInteracted.current = true;
    setCurrentValue(newValue);
  };

  // Auto-advancement logic (restored from working version)
  React.useEffect(() => {
    const valueChanged = currentValue !== lastValueForStepAdvancement.current;
    const currentExpectedStep = expectedSteps[currentStep];

    console.log('🔍 Expected step advancement check:', {
      currentValue,
      lastValue: lastValueForStepAdvancement.current,
      valueChanged,
      userHasInteracted: userHasInteracted.current,
      expectedStepIndex: currentStep,
      expectedStepTarget: currentExpectedStep?.targetValue,
      expectedStepReached: currentExpectedStep ? currentValue === currentExpectedStep.targetValue : false,
      totalExpectedSteps: expectedSteps.length,
      finalTargetReached: currentValue === targetValue
    });

    if (valueChanged && userHasInteracted.current && expectedSteps.length > 0 && currentExpectedStep) {
      if (currentValue === currentExpectedStep.targetValue) {
        const hasMoreExpectedSteps = currentStep < expectedSteps.length - 1;

        console.log('🎯 Expected step completed:', {
          completedStep: currentStep,
          targetReached: currentExpectedStep.targetValue,
          hasMoreSteps: hasMoreExpectedSteps,
          willAdvance: hasMoreExpectedSteps
        });

        if (hasMoreExpectedSteps) {
          const timeoutId = setTimeout(() => {
            console.log('⚡ Advancing to next expected step:', currentStep, '→', currentStep + 1);
            setCurrentStep(prev => prev + 1);
            lastValueForStepAdvancement.current = currentValue;
          }, 500); // Reduced delay for better UX

          return () => clearTimeout(timeoutId);
        }
      }
    }
  }, [currentValue, currentStep, expectedSteps, targetValue]);

  // Update reference when step changes
  React.useEffect(() => {
    lastValueForStepAdvancement.current = currentValue;
    userHasInteracted.current = false;
  }, [currentStep]);

  const resetDemo = () => {
    setCurrentValue(startValue);
    setCurrentStep(0);
    userHasInteracted.current = false;
    lastValueForStepAdvancement.current = startValue;
    console.log('🔄 Reset demo');
  };

  const progress = expectedSteps.length > 0 ? ((currentStep + 1) / expectedSteps.length) * 100 : 0;

  return (
    <div style={{ textAlign: 'center', padding: '20px' }}>
      <h3>{title}</h3>
      {description && <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>{description}</p>}

      <div style={{ marginBottom: '20px', fontSize: '14px' }}>
        <p><strong>Progress:</strong> {currentStep + 1} of {expectedSteps.length || 1} steps ({Math.round(progress)}%)</p>
        <p><strong>Current Value:</strong> {currentValue} | <strong>Target:</strong> {targetValue}</p>
      </div>

      <AbacusReact
        value={currentValue}
        columns={columns}
        scaleFactor={3}
        interactive={true}
        animated={true}
        colorScheme="place-value"
        stepBeadHighlights={currentStepBeads}
        currentStep={currentStep}
        showDirectionIndicators={true}
        onValueChange={handleValueChange}
      />

      <div style={{ marginTop: '20px' }}>
        <button
          onClick={resetDemo}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4A90E2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Reset
        </button>
      </div>

      {/* Debug Info Section */}
      <div style={{
        marginTop: '20px',
        padding: '12px',
        backgroundColor: '#663399',
        color: 'white',
        borderRadius: '8px',
        fontSize: '11px',
        textAlign: 'left',
        maxWidth: '500px',
        margin: '20px auto'
      }}>
        <strong>Step Debug Info:</strong><br />
        Current Multi-Step: {currentStep}<br />
        Total Steps: {expectedSteps.length}<br />
        Step Bead Highlights: {currentStepBeads?.length || 0}<br />
        Show Direction Indicators: {true}<br />
        Expected Step Target: {expectedSteps[currentStep]?.targetValue || 'N/A'}<br />
        User Has Interacted: {userHasInteracted.current ? 'Yes' : 'No'}<br />
        {currentStepBeads && currentStepBeads.length > 0 && (
          <>
            <br />Current Step Beads ({currentStep}):<br />
            {currentStepBeads.map((bead, i) => (
              <span key={i}>
                - Place {bead.placeValue} {bead.beadType}
                {bead.position !== undefined ? ` pos ${bead.position}` : ''} → {bead.direction}<br />
              </span>
            ))}
          </>
        )}
      </div>

      {expectedSteps.length > 0 && (
        <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
          <p><strong>Expected Steps:</strong></p>
          <ol style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
            {expectedSteps.map((step, index) => (
              <li key={index} style={{
                backgroundColor: currentStep === index ? '#e3f2fd' : 'transparent',
                padding: currentStep === index ? '8px' : '4px',
                borderRadius: currentStep === index ? '4px' : '0',
                fontWeight: currentStep === index ? 'bold' : 'normal',
                border: currentStep === index ? '2px solid #2196f3' : 'none',
                opacity: currentStep < index ? 0.5 : 1
              }}>
                {currentStep === index && '👉 '} {step.description}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
};

const meta: Meta<typeof AbacusReact> = {
  title: 'Progressive/Stress Test Suite',
  component: AbacusReact,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
# Progressive Instruction Stress Test Suite

Comprehensive test cases for the progressive multi-step instruction system covering:
- Simple additions
- Five complement operations
- Ten complement operations
- Multi-digit operations
- Subtraction operations
- Edge cases and complex scenarios
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AbacusReact>;

// Basic operations
export const SimpleAddition: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Simple Addition: 0 + 3 = 3"
      startValue={0}
      targetValue={3}
      columns={1}
      description="Basic earth bead additions, one by one"
    />
  )
};

export const HeavenBeadSimple: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Heaven Bead: 0 + 5 = 5"
      startValue={0}
      targetValue={5}
      columns={1}
      description="Single heaven bead activation"
    />
  )
};

// Five complement operations
export const FiveComplementBasic: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Five Complement: 2 + 3 = 5"
      startValue={2}
      targetValue={5}
      columns={1}
      description="2 + 3 = 2 + (5 - 2): Add heaven bead, then remove 2 earth beads"
    />
  )
};

export const FiveComplementAdvanced: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Five Complement: 3 + 4 = 7"
      startValue={3}
      targetValue={7}
      columns={1}
      description="3 + 4 = 3 + (5 - 1): Add heaven bead, then remove 1 earth bead"
    />
  )
};

// Ten operations
export const TensAddition: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Tens Addition: 5 + 10 = 15"
      startValue={5}
      targetValue={15}
      description="Simple tens place earth bead addition"
    />
  )
};

export const TenComplement: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Ten Complement: 8 + 6 = 14"
      startValue={8}
      targetValue={14}
      description="8 + 6 = 8 + (10 - 4): Add 10, then remove 4"
    />
  )
};

// Subtraction operations
export const SimpleSubtraction: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Subtraction: 9 - 4 = 5"
      startValue={9}
      targetValue={5}
      columns={1}
      description="Sequential earth bead removal, one by one"
    />
  )
};

// Original working case
export const ThreePlusFourteen: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Complex: 3 + 14 = 17"
      startValue={3}
      targetValue={17}
      description="3 + 14 = 3 + 10 + (5 - 1): Multi-step with tens and five complement"
    />
  )
};

// Edge cases and stress tests
export const ZeroToNine: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Full Digit: 0 + 9 = 9"
      startValue={0}
      targetValue={9}
      columns={1}
      description="Activate all beads in ones place (heaven + 4 earth)"
    />
  )
};

export const CrossingTens: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Crossing Tens: 7 + 8 = 15"
      startValue={7}
      targetValue={15}
      description="7 + 8 with ten complement: complex multi-step operation"
    />
  )
};

export const LargeSubtraction: Story = {
  render: () => (
    <ProgressiveTestComponent
      title="Large Subtraction: 18 - 9 = 9"
      startValue={18}
      targetValue={9}
      description="Complex subtraction across place values"
    />
  )
};

// Rapid-fire simple tests
export const RapidTests: Story = {
  render: () => {
    const [testIndex, setTestIndex] = useState(0);

    const rapidTests = [
      { start: 0, target: 1, title: "0 + 1" },
      { start: 1, target: 2, title: "1 + 1" },
      { start: 0, target: 5, title: "0 + 5" },
      { start: 2, target: 5, title: "2 + 3 (complement)" },
      { start: 5, target: 15, title: "5 + 10" },
      { start: 9, target: 5, title: "9 - 4" }
    ];

    const currentTest = rapidTests[testIndex];

    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <h3>Rapid Fire Tests ({testIndex + 1}/{rapidTests.length})</h3>

        <div style={{ marginBottom: '20px' }}>
          <button
            onClick={() => setTestIndex((prev) => (prev + 1) % rapidTests.length)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Next Test →
          </button>
        </div>

        <ProgressiveTestComponent
          key={`${currentTest.start}-${currentTest.target}`}
          title={currentTest.title}
          startValue={currentTest.start}
          targetValue={currentTest.target}
          columns={2}
          description="Quick succession testing for responsiveness"
        />
      </div>
    );
  }
};