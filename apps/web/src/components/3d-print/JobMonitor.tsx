'use client'

import { useEffect, useState } from 'react'
import { css } from '../../../styled-system/css'

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed'

interface Job {
  id: string
  status: JobStatus
  progress?: string
  error?: string
  createdAt: string
  completedAt?: string
}

interface JobMonitorProps {
  jobId: string
  onComplete: () => void
}

export function JobMonitor({ jobId, onComplete }: JobMonitorProps) {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let pollInterval: NodeJS.Timeout

    const pollStatus = async () => {
      try {
        const response = await fetch(`/api/abacus/status/${jobId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch job status')
        }
        const data = await response.json()
        setJob(data)

        if (data.status === 'completed') {
          onComplete()
          clearInterval(pollInterval)
        } else if (data.status === 'failed') {
          setError(data.error || 'Job failed')
          clearInterval(pollInterval)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        clearInterval(pollInterval)
      }
    }

    // Poll immediately
    pollStatus()

    // Then poll every 1 second
    pollInterval = setInterval(pollStatus, 1000)

    return () => clearInterval(pollInterval)
  }, [jobId, onComplete])

  if (error) {
    return (
      <div
        data-status="error"
        className={css({
          p: 4,
          bg: 'red.100',
          borderRadius: '8px',
          borderLeft: '4px solid',
          borderColor: 'red.600',
        })}
      >
        <div className={css({ fontWeight: 'bold', color: 'red.800', mb: 1 })}>Error</div>
        <div className={css({ color: 'red.700' })}>{error}</div>
      </div>
    )
  }

  if (!job) {
    return (
      <div data-status="loading" className={css({ p: 4, textAlign: 'center' })}>
        Loading...
      </div>
    )
  }

  const statusColors = {
    pending: 'blue',
    processing: 'yellow',
    completed: 'green',
    failed: 'red',
  }

  const statusColor = statusColors[job.status]

  return (
    <div
      data-component="job-monitor"
      className={css({
        p: 4,
        bg: `${statusColor}.50`,
        borderRadius: '8px',
        borderLeft: '4px solid',
        borderColor: `${statusColor}.600`,
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 2,
        })}
      >
        <div
          data-status={job.status}
          className={css({
            fontWeight: 'bold',
            color: `${statusColor}.800`,
            textTransform: 'capitalize',
          })}
        >
          {job.status}
        </div>
        {(job.status === 'pending' || job.status === 'processing') && (
          <div
            className={css({
              width: '16px',
              height: '16px',
              border: '2px solid',
              borderColor: `${statusColor}.600`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            })}
          />
        )}
      </div>
      {job.progress && (
        <div className={css({ color: `${statusColor}.700`, fontSize: 'sm' })}>{job.progress}</div>
      )}
      {job.error && (
        <div className={css({ color: 'red.700', fontSize: 'sm', mt: 2 })}>Error: {job.error}</div>
      )}
    </div>
  )
}
