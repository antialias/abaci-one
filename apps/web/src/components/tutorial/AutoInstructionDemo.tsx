import React, { useState } from 'react'
import { generateAbacusInstructions, validateInstruction } from '../../utils/abacusInstructionGenerator'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

export function AutoInstructionDemo() {
  const [startValue, setStartValue] = useState(0)
  const [targetValue, setTargetValue] = useState(1)
  const [generatedInstruction, setGeneratedInstruction] = useState<any>(null)

  const handleGenerate = () => {
    const instruction = generateAbacusInstructions(startValue, targetValue)
    const validation = validateInstruction(instruction, startValue, targetValue)

    setGeneratedInstruction({
      ...instruction,
      validation
    })
  }

  const presetExamples = [
    { start: 0, target: 1, name: "Basic: 0 + 1" },
    { start: 0, target: 5, name: "Heaven: 0 + 5" },
    { start: 3, target: 7, name: "Five complement: 3 + 4" },
    { start: 2, target: 5, name: "Five complement: 2 + 3" },
    { start: 6, target: 8, name: "Direct: 6 + 2" },
    { start: 7, target: 11, name: "Ten complement: 7 + 4" },
    { start: 15, target: 23, name: "Multi-place: 15 + 8" }
  ]

  return (
    <div className={vstack({ gap: 6, p: 6, maxW: '800px', mx: 'auto' })}>
      <h2 className={css({ fontSize: '2xl', fontWeight: 'bold', textAlign: 'center' })}>
        🤖 Automatic Abacus Instruction Generator
      </h2>

      <div className={css({
        p: 4,
        bg: 'blue.50',
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'blue.200'
      })}>
        <p className={css({ fontSize: 'sm', color: 'blue.800' })}>
          Enter any start and target values, and the system will automatically generate correct abacus instructions,
          including complement operations, multi-step procedures, and proper bead highlighting.
        </p>
      </div>

      {/* Input Controls */}
      <div className={hstack({ gap: 4, justifyContent: 'center' })}>
        <div className={vstack({ gap: 2 })}>
          <label className={css({ fontSize: 'sm', fontWeight: 'medium' })}>Start Value</label>
          <input
            type="number"
            min="0"
            max="99"
            value={startValue}
            onChange={(e) => setStartValue(parseInt(e.target.value) || 0)}
            className={css({
              p: 2,
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              w: '80px',
              textAlign: 'center'
            })}
          />
        </div>

        <div className={css({ alignSelf: 'end', fontSize: '2xl', pb: 2 })}>→</div>

        <div className={vstack({ gap: 2 })}>
          <label className={css({ fontSize: 'sm', fontWeight: 'medium' })}>Target Value</label>
          <input
            type="number"
            min="0"
            max="99"
            value={targetValue}
            onChange={(e) => setTargetValue(parseInt(e.target.value) || 0)}
            className={css({
              p: 2,
              border: '1px solid',
              borderColor: 'gray.300',
              borderRadius: 'md',
              w: '80px',
              textAlign: 'center'
            })}
          />
        </div>

        <button
          onClick={handleGenerate}
          className={css({
            px: 4,
            py: 2,
            bg: 'blue.600',
            color: 'white',
            borderRadius: 'md',
            fontWeight: 'medium',
            cursor: 'pointer',
            alignSelf: 'end',
            _hover: { bg: 'blue.700' }
          })}
        >
          Generate Instructions
        </button>
      </div>

      {/* Preset Examples */}
      <div className={vstack({ gap: 3 })}>
        <h3 className={css({ fontSize: 'lg', fontWeight: 'medium' })}>Quick Examples:</h3>
        <div className={css({ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' })}>
          {presetExamples.map((example, index) => (
            <button
              key={index}
              onClick={() => {
                setStartValue(example.start)
                setTargetValue(example.target)
              }}
              className={css({
                px: 3,
                py: 1,
                fontSize: 'xs',
                bg: 'gray.100',
                border: '1px solid',
                borderColor: 'gray.300',
                borderRadius: 'md',
                cursor: 'pointer',
                _hover: { bg: 'gray.200' }
              })}
            >
              {example.name}
            </button>
          ))}
        </div>
      </div>

      {/* Generated Instructions */}
      {generatedInstruction && (
        <div className={vstack({ gap: 4, p: 4, bg: 'white', border: '2px solid', borderColor: 'gray.200', borderRadius: 'lg' })}>
          <div className={hstack({ justifyContent: 'space-between', alignItems: 'center' })}>
            <h3 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>
              Generated Instructions: {startValue} → {targetValue}
            </h3>
            <div className={css({
              px: 2,
              py: 1,
              fontSize: 'xs',
              bg: generatedInstruction.validation.isValid ? 'green.100' : 'red.100',
              color: generatedInstruction.validation.isValid ? 'green.800' : 'red.800',
              borderRadius: 'md'
            })}>
              {generatedInstruction.validation.isValid ? '✅ Valid' : '❌ Invalid'}
            </div>
          </div>

          {!generatedInstruction.validation.isValid && (
            <div className={css({ p: 3, bg: 'red.50', borderRadius: 'md', color: 'red.800' })}>
              <strong>Issues:</strong> {generatedInstruction.validation.issues.join(', ')}
            </div>
          )}

          <div className={vstack({ gap: 3, alignItems: 'start' })}>
            <div>
              <strong>Action Type:</strong> {generatedInstruction.expectedAction}
            </div>

            <div>
              <strong>Description:</strong> {generatedInstruction.actionDescription}
            </div>

            <div>
              <strong>Highlighted Beads:</strong> {generatedInstruction.highlightBeads.length}
              <ul className={css({ ml: 4, mt: 1 })}>
                {generatedInstruction.highlightBeads.map((bead: any, index: number) => (
                  <li key={index} className={css({ fontSize: 'sm' })}>
                    Place {bead.placeValue} ({bead.placeValue === 0 ? 'ones' : bead.placeValue === 1 ? 'tens' : 'place ' + bead.placeValue}) -
                    {bead.beadType} {bead.position !== undefined ? `position ${bead.position}` : 'bead'}
                  </li>
                ))}
              </ul>
            </div>

            {generatedInstruction.multiStepInstructions && (
              <div>
                <strong>Step-by-Step Instructions:</strong>
                <ol className={css({ ml: 4, mt: 1 })}>
                  {generatedInstruction.multiStepInstructions.map((instruction: string, index: number) => (
                    <li key={index} className={css({ fontSize: 'sm' })}>
                      {instruction}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className={vstack({ gap: 2, alignItems: 'start' })}>
              <div>
                <strong>Tooltip:</strong> {generatedInstruction.tooltip.content}
              </div>
              <div className={css({ fontSize: 'sm', color: 'gray.600' })}>
                {generatedInstruction.tooltip.explanation}
              </div>
            </div>

            <div className={vstack({ gap: 1, alignItems: 'start' })}>
              <div><strong>Error Messages:</strong></div>
              <div className={css({ fontSize: 'sm' })}>
                <strong>Wrong Bead:</strong> {generatedInstruction.errorMessages.wrongBead}
              </div>
              <div className={css({ fontSize: 'sm' })}>
                <strong>Wrong Action:</strong> {generatedInstruction.errorMessages.wrongAction}
              </div>
              <div className={css({ fontSize: 'sm' })}>
                <strong>Hint:</strong> {generatedInstruction.errorMessages.hint}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}