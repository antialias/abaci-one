'use client'

import { AbacusReact } from '@soroban/abacus-react'
import { useState } from 'react'
import { css } from '../../../styled-system/css'

export default function AbacusTestPage() {
  const [value, setValue] = useState(0)
  const [debugInfo, setDebugInfo] = useState<string>('')

  const handleValueChange = (newValue: number | bigint) => {
    setValue(Number(newValue))
    setDebugInfo(`Value changed to: ${newValue}`)
    console.log('Abacus value:', newValue)
  }

  return (
    <div
      className={css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        bg: 'gray.50',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4',
      })}
    >
      {/* Debug info */}
      <div
        className={css({
          position: 'absolute',
          top: '4',
          left: '4',
          bg: 'white',
          p: '3',
          rounded: 'md',
          border: '1px solid',
          borderColor: 'gray.300',
          fontSize: 'sm',
          fontFamily: 'mono',
        })}
      >
        <div>Current Value: {value}</div>
        <div>{debugInfo}</div>
        <button
          onClick={() => setValue(0)}
          className={css({
            mt: '2',
            px: '2',
            py: '1',
            bg: 'blue.500',
            color: 'white',
            rounded: 'sm',
            fontSize: 'xs',
            cursor: 'pointer',
          })}
        >
          Reset to 0
        </button>
        <button
          onClick={() => setValue(12345)}
          className={css({
            mt: '1',
            px: '2',
            py: '1',
            bg: 'green.500',
            color: 'white',
            rounded: 'sm',
            fontSize: 'xs',
            cursor: 'pointer',
          })}
        >
          Set to 12345
        </button>
      </div>

      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AbacusReact
          value={value}
          columns={5}
          beadShape="diamond"
          colorScheme="place-value"
          hideInactiveBeads={false}
          scaleFactor={3.0}
          interactive={true}
          showNumbers={true}
          animated={true}
          onValueChange={handleValueChange}
        />
      </div>
    </div>
  )
}
