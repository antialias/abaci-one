'use client'

import * as Toast from '@radix-ui/react-toast'
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastMessage {
  id: string
  type: 'success' | 'error' | 'info'
  title: string
  description?: string
  duration?: number
  action?: ToastAction
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, 'id'>) => void
  showSuccess: (title: string, description?: string) => void
  showError: (title: string, description?: string) => void
  showInfo: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const showToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(7)
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const showSuccess = useCallback(
    (title: string, description?: string) => {
      showToast({ type: 'success', title, description, duration: 5000 })
    },
    [showToast]
  )

  const showError = useCallback(
    (title: string, description?: string) => {
      showToast({ type: 'error', title, description, duration: 7000 })
    },
    [showToast]
  )

  const showInfo = useCallback(
    (title: string, description?: string) => {
      showToast({ type: 'info', title, description, duration: 5000 })
    },
    [showToast]
  )

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const getToastStyles = (type: ToastMessage['type']) => {
    switch (type) {
      case 'success':
        return {
          background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.97), rgba(22, 163, 74, 0.97))',
          border: '2px solid rgba(34, 197, 94, 0.6)',
          icon: '✓',
        }
      case 'error':
        return {
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.97), rgba(220, 38, 38, 0.97))',
          border: '2px solid rgba(239, 68, 68, 0.6)',
          icon: '⚠',
        }
      case 'info':
        return {
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.97), rgba(37, 99, 235, 0.97))',
          border: '2px solid rgba(59, 130, 246, 0.6)',
          icon: 'ℹ',
        }
    }
  }

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo }}>
      {children}
      <Toast.Provider swipeDirection="right">
        {toasts.map((toast) => {
          const styles = getToastStyles(toast.type)
          return (
            <Toast.Root
              key={toast.id}
              open={true}
              onOpenChange={(open) => {
                if (!open) {
                  removeToast(toast.id)
                }
              }}
              duration={toast.duration}
              style={{
                background: styles.background,
                border: styles.border,
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                minWidth: '300px',
                maxWidth: '450px',
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{ fontSize: '20px', flexShrink: 0 }}>{styles.icon}</div>
              <div style={{ flex: 1 }}>
                <Toast.Title
                  style={{
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: 'white',
                    marginBottom: toast.description ? '4px' : 0,
                  }}
                >
                  {toast.title}
                </Toast.Title>
                {toast.description && (
                  <Toast.Description
                    style={{
                      fontSize: '13px',
                      color: 'rgba(255, 255, 255, 0.9)',
                    }}
                  >
                    {toast.description}
                  </Toast.Description>
                )}
                {toast.action && (
                  <Toast.Action asChild altText={toast.action.label}>
                    <button
                      type="button"
                      onClick={() => {
                        toast.action!.onClick()
                        removeToast(toast.id)
                      }}
                      style={{
                        marginTop: '8px',
                        padding: '4px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.4)',
                        background: 'rgba(255, 255, 255, 0.15)',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {toast.action.label}
                    </button>
                  </Toast.Action>
                )}
              </div>
              <Toast.Close
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'white',
                  fontSize: '16px',
                  lineHeight: 1,
                  flexShrink: 0,
                }}
              >
                ×
              </Toast.Close>
            </Toast.Root>
          )
        })}

        <Toast.Viewport
          style={{
            position: 'fixed',
            top: '80px',
            right: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            zIndex: 10001,
            maxWidth: '100vw',
            margin: 0,
            listStyle: 'none',
            outline: 'none',
          }}
        />

        <style
          dangerouslySetInnerHTML={{
            __html: `
              @keyframes toastSlideIn {
                from {
                  transform: translateX(calc(100% + 25px));
                }
                to {
                  transform: translateX(0);
                }
              }

              @keyframes toastSlideOut {
                from {
                  transform: translateX(0);
                }
                to {
                  transform: translateX(calc(100% + 25px));
                }
              }

              @keyframes toastHide {
                from {
                  opacity: 1;
                }
                to {
                  opacity: 0;
                }
              }

              [data-radix-toast-viewport] [data-state='open'] {
                animation: toastSlideIn 150ms cubic-bezier(0.16, 1, 0.3, 1);
              }

              [data-radix-toast-viewport] [data-state='closed'] {
                animation: toastHide 100ms ease-in, toastSlideOut 200ms cubic-bezier(0.32, 0, 0.67, 0);
              }

              [data-radix-toast-viewport] [data-swipe='move'] {
                transform: translateX(var(--radix-toast-swipe-move-x));
              }

              [data-radix-toast-viewport] [data-swipe='cancel'] {
                transform: translateX(0);
                transition: transform 200ms ease-out;
              }

              [data-radix-toast-viewport] [data-swipe='end'] {
                animation: toastSlideOut 100ms ease-out;
              }
            `,
          }}
        />
      </Toast.Provider>
    </ToastContext.Provider>
  )
}
