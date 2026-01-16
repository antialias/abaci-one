import Link from 'next/link'
import { getFlowchartList } from '@/lib/flowcharts/definitions'
import { css } from '../../../styled-system/css'
import { vstack, hstack } from '../../../styled-system/patterns'

export default function FlowchartPickerPage() {
  const flowcharts = getFlowchartList()

  return (
    <div className={vstack({ gap: '8', padding: '6', alignItems: 'center', minHeight: '100vh' })}>
      <header className={vstack({ gap: '2', alignItems: 'center' })}>
        <h1
          className={css({
            fontSize: '3xl',
            fontWeight: 'bold',
            color: { base: 'gray.900', _dark: 'gray.100' },
          })}
        >
          Flowchart Practice
        </h1>
        <p
          className={css({
            fontSize: 'lg',
            color: { base: 'gray.600', _dark: 'gray.400' },
            textAlign: 'center',
            maxWidth: '500px',
          })}
        >
          Step through math procedures one step at a time. Perfect for learning new algorithms!
        </p>
      </header>

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '4',
          width: '100%',
          maxWidth: '800px',
        })}
      >
        {flowcharts.map((flowchart) => (
          <Link
            key={flowchart.id}
            href={`/flowchart/${flowchart.id}`}
            className={css({
              display: 'block',
              padding: '6',
              backgroundColor: { base: 'white', _dark: 'gray.800' },
              borderRadius: 'xl',
              boxShadow: 'md',
              border: '2px solid',
              borderColor: { base: 'gray.200', _dark: 'gray.700' },
              transition: 'all 0.2s',
              textDecoration: 'none',
              _hover: {
                borderColor: { base: 'blue.400', _dark: 'blue.500' },
                transform: 'translateY(-2px)',
                boxShadow: 'lg',
              },
            })}
          >
            <div className={hstack({ gap: '4', alignItems: 'flex-start' })}>
              <span className={css({ fontSize: '3xl' })}>{flowchart.emoji}</span>
              <div className={vstack({ gap: '1', alignItems: 'flex-start' })}>
                <h2
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'semibold',
                    color: { base: 'gray.900', _dark: 'gray.100' },
                  })}
                >
                  {flowchart.title}
                </h2>
                <p
                  className={css({
                    fontSize: 'sm',
                    color: { base: 'gray.600', _dark: 'gray.400' },
                  })}
                >
                  {flowchart.description}
                </p>
                <span
                  className={css({
                    fontSize: 'xs',
                    padding: '1 2',
                    borderRadius: 'full',
                    backgroundColor: { base: 'blue.100', _dark: 'blue.900' },
                    color: { base: 'blue.700', _dark: 'blue.300' },
                    marginTop: '1',
                  })}
                >
                  {flowchart.difficulty}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <footer
        className={css({
          marginTop: 'auto',
          padding: '4',
          color: { base: 'gray.500', _dark: 'gray.500' },
          fontSize: 'sm',
        })}
      >
        More flowcharts coming soon!
      </footer>
    </div>
  )
}
