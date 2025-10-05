'use client'

import React, { useState, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Info, X, GitBranch, GitCommit, Clock, Package, Server } from 'lucide-react'
import { css } from '../../styled-system/css'
import { vstack, hstack } from '../../styled-system/patterns'

interface BuildInfo {
  version: string
  buildTime: string
  buildTimestamp: number
  git: {
    commit: string | null
    commitShort: string | null
    branch: string | null
    tag: string | null
    isDirty: boolean
  }
  environment: string
  buildNumber: string | null
  nodeVersion: string
}

export function DeploymentInfo() {
  const [open, setOpen] = useState(false)
  const [buildInfo, setBuildInfo] = useState<BuildInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Keyboard shortcut: Cmd/Ctrl + Shift + I
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    if (open && !buildInfo) {
      fetch('/api/build-info')
        .then(res => res.json())
        .then(data => {
          setBuildInfo(data)
          setLoading(false)
        })
        .catch(err => {
          console.error('Failed to load build info:', err)
          setLoading(false)
        })
    }
  }, [open, buildInfo])

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    })
  }

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)

    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
      second: 1
    }

    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInUnit)
      if (interval >= 1) {
        return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`
      }
    }
    return 'just now'
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className={css({
          position: 'fixed',
          inset: '0',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998,
          animation: 'fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        })} />
        <Dialog.Content className={css({
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'white',
          borderRadius: 'lg',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          padding: '6',
          width: '90vw',
          maxWidth: '500px',
          maxHeight: '85vh',
          overflow: 'auto',
          zIndex: 9999,
          animation: 'contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
        })}>
          <Dialog.Title className={css({
            fontSize: 'xl',
            fontWeight: 'semibold',
            marginBottom: '4',
            display: 'flex',
            alignItems: 'center',
            gap: '2'
          })}>
            <Info size={24} />
            Deployment Information
          </Dialog.Title>

          {loading ? (
            <div className={css({ textAlign: 'center', padding: '8' })}>
              Loading...
            </div>
          ) : buildInfo ? (
            <div className={vstack({ alignItems: 'stretch', gap: '4' })}>
              <InfoRow
                icon={<Package size={18} />}
                label="Version"
                value={buildInfo.version}
              />

              <InfoRow
                icon={<Clock size={18} />}
                label="Build Time"
                value={
                  <div className={vstack({ alignItems: 'flex-start', gap: '1' })}>
                    <span>{formatTimestamp(buildInfo.buildTimestamp)}</span>
                    <span className={css({ fontSize: 'sm', color: 'gray.600' })}>
                      {getTimeAgo(buildInfo.buildTimestamp)}
                    </span>
                  </div>
                }
              />

              {buildInfo.git.branch && (
                <InfoRow
                  icon={<GitBranch size={18} />}
                  label="Branch"
                  value={
                    <span className={css({
                      fontFamily: 'mono',
                      fontSize: 'sm',
                      backgroundColor: 'gray.100',
                      padding: '1 2',
                      borderRadius: 'sm'
                    })}>
                      {buildInfo.git.branch}
                      {buildInfo.git.isDirty && (
                        <span className={css({ color: 'orange.600', marginLeft: '2' })}>
                          (dirty)
                        </span>
                      )}
                    </span>
                  }
                />
              )}

              {buildInfo.git.commitShort && (
                <InfoRow
                  icon={<GitCommit size={18} />}
                  label="Commit"
                  value={
                    <div className={vstack({ alignItems: 'flex-start', gap: '1' })}>
                      <span className={css({
                        fontFamily: 'mono',
                        fontSize: 'sm',
                        backgroundColor: 'gray.100',
                        padding: '1 2',
                        borderRadius: 'sm'
                      })}>
                        {buildInfo.git.commitShort}
                      </span>
                      {buildInfo.git.commit && (
                        <span className={css({
                          fontFamily: 'mono',
                          fontSize: 'xs',
                          color: 'gray.500'
                        })}>
                          {buildInfo.git.commit}
                        </span>
                      )}
                    </div>
                  }
                />
              )}

              {buildInfo.git.tag && (
                <InfoRow
                  icon={<Package size={18} />}
                  label="Tag"
                  value={
                    <span className={css({
                      fontFamily: 'mono',
                      fontSize: 'sm',
                      backgroundColor: 'blue.100',
                      color: 'blue.700',
                      padding: '1 2',
                      borderRadius: 'sm'
                    })}>
                      {buildInfo.git.tag}
                    </span>
                  }
                />
              )}

              <InfoRow
                icon={<Server size={18} />}
                label="Environment"
                value={
                  <span className={css({
                    fontFamily: 'mono',
                    fontSize: 'sm',
                    backgroundColor: buildInfo.environment === 'production' ? 'green.100' : 'yellow.100',
                    color: buildInfo.environment === 'production' ? 'green.700' : 'yellow.700',
                    padding: '1 2',
                    borderRadius: 'sm'
                  })}>
                    {buildInfo.environment}
                  </span>
                }
              />

              {buildInfo.buildNumber && (
                <InfoRow
                  label="Build Number"
                  value={buildInfo.buildNumber}
                />
              )}

              <InfoRow
                label="Node Version"
                value={
                  <span className={css({ fontFamily: 'mono', fontSize: 'sm' })}>
                    {buildInfo.nodeVersion}
                  </span>
                }
              />
            </div>
          ) : (
            <div className={css({ textAlign: 'center', padding: '8', color: 'gray.600' })}>
              Failed to load build information
            </div>
          )}

          <div className={css({
            marginTop: '6',
            paddingTop: '4',
            borderTop: '1px solid',
            borderColor: 'gray.200',
            fontSize: 'sm',
            color: 'gray.600',
            textAlign: 'center'
          })}>
            Press <kbd className={css({
              fontFamily: 'mono',
              backgroundColor: 'gray.100',
              padding: '0.5 1.5',
              borderRadius: 'sm',
              border: '1px solid',
              borderColor: 'gray.300'
            })}>⌘⇧I</kbd> or <kbd className={css({
              fontFamily: 'mono',
              backgroundColor: 'gray.100',
              padding: '0.5 1.5',
              borderRadius: 'sm',
              border: '1px solid',
              borderColor: 'gray.300'
            })}>Ctrl⇧I</kbd> to toggle
          </div>

          <Dialog.Close className={css({
            position: 'absolute',
            top: '4',
            right: '4',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 'md',
            padding: '2',
            color: 'gray.700',
            cursor: 'pointer',
            _hover: {
              backgroundColor: 'gray.100'
            }
          })}>
            <X size={20} />
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function InfoRow({
  icon,
  label,
  value
}: {
  icon?: React.ReactNode
  label: string
  value: React.ReactNode
}) {
  return (
    <div className={hstack({
      justifyContent: 'space-between',
      gap: '4',
      paddingY: '2',
      borderBottom: '1px solid',
      borderColor: 'gray.100'
    })}>
      <div className={hstack({ gap: '2', color: 'gray.700' })}>
        {icon}
        <span className={css({ fontWeight: 'medium' })}>{label}</span>
      </div>
      <div className={css({ textAlign: 'right', flex: '1' })}>
        {value}
      </div>
    </div>
  )
}
