import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../../styled-system/css'

/**
 * Skeleton component shown while practice page data is loading
 *
 * This is used as a fallback for the Suspense boundary, but in practice
 * it should rarely be seen since data is prefetched on the server.
 * It may appear briefly during client-side navigation.
 */
export function PracticePageSkeleton() {
  return (
    <PageWithNav>
      <main
        data-component="practice-page-skeleton"
        className={css({
          minHeight: '100vh',
          backgroundColor: 'gray.50',
          paddingTop: 'calc(80px + 2rem)',
          paddingLeft: '2rem',
          paddingRight: '2rem',
          paddingBottom: '2rem',
        })}
      >
        <div
          className={css({
            maxWidth: '800px',
            margin: '0 auto',
          })}
        >
          {/* Header skeleton */}
          <header
            className={css({
              textAlign: 'center',
              marginBottom: '2rem',
            })}
          >
            <div
              className={css({
                width: '200px',
                height: '2rem',
                backgroundColor: 'gray.200',
                borderRadius: '8px',
                margin: '0 auto 0.5rem auto',
                animation: 'pulse 1.5s ease-in-out infinite',
              })}
            />
            <div
              className={css({
                width: '280px',
                height: '1rem',
                backgroundColor: 'gray.200',
                borderRadius: '4px',
                margin: '0 auto',
                animation: 'pulse 1.5s ease-in-out infinite',
              })}
            />
          </header>

          {/* Dashboard card skeleton */}
          <div
            className={css({
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: 'md',
              padding: '2rem',
            })}
          >
            {/* Student info skeleton */}
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                marginBottom: '2rem',
              })}
            >
              <div
                className={css({
                  width: '60px',
                  height: '60px',
                  backgroundColor: 'gray.200',
                  borderRadius: '50%',
                  animation: 'pulse 1.5s ease-in-out infinite',
                })}
              />
              <div>
                <div
                  className={css({
                    width: '150px',
                    height: '1.5rem',
                    backgroundColor: 'gray.200',
                    borderRadius: '4px',
                    marginBottom: '0.5rem',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  })}
                />
                <div
                  className={css({
                    width: '100px',
                    height: '1rem',
                    backgroundColor: 'gray.200',
                    borderRadius: '4px',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  })}
                />
              </div>
            </div>

            {/* Phase info skeleton */}
            <div
              className={css({
                backgroundColor: 'gray.50',
                borderRadius: '12px',
                padding: '1.5rem',
                marginBottom: '2rem',
              })}
            >
              <div
                className={css({
                  width: '120px',
                  height: '1rem',
                  backgroundColor: 'gray.200',
                  borderRadius: '4px',
                  marginBottom: '0.75rem',
                  animation: 'pulse 1.5s ease-in-out infinite',
                })}
              />
              <div
                className={css({
                  width: '200px',
                  height: '1.25rem',
                  backgroundColor: 'gray.200',
                  borderRadius: '4px',
                  marginBottom: '0.5rem',
                  animation: 'pulse 1.5s ease-in-out infinite',
                })}
              />
              <div
                className={css({
                  width: '100%',
                  height: '0.875rem',
                  backgroundColor: 'gray.200',
                  borderRadius: '4px',
                  animation: 'pulse 1.5s ease-in-out infinite',
                })}
              />
            </div>

            {/* Button skeleton */}
            <div
              className={css({
                width: '100%',
                height: '56px',
                backgroundColor: 'gray.200',
                borderRadius: '12px',
                animation: 'pulse 1.5s ease-in-out infinite',
              })}
            />
          </div>
        </div>
      </main>
    </PageWithNav>
  )
}
