'use client'

import React, { createContext, useCallback, useContext, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  title?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  toast: (options: { message: string; type?: ToastType; title?: string; duration?: number }) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

let globalToastHandler: ((options: { message: string; type?: ToastType; title?: string; duration?: number }) => void) | null = null

export const toast = {
  success: (message: string, title?: string) => globalToastHandler?.({ message, title, type: 'success' }),
  error: (message: string, title?: string) => globalToastHandler?.({ message, title, type: 'error' }),
  info: (message: string, title?: string) => globalToastHandler?.({ message, title, type: 'info' }),
  warning: (message: string, title?: string) => globalToastHandler?.({ message, title, type: 'warning' }),
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback(({ message, type = 'info', title, duration = 4000 }: {
    message: string
    type?: ToastType
    title?: string
    duration?: number
  }) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = { id, message, type, title, duration }

    setToasts(prev => [...prev.slice(-4), newToast])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  globalToastHandler = addToast

  return (
    <ToastContext.Provider value={{ toasts, toast: addToast, removeToast }}>
      {children}
      {/* Toast Render Viewport */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2 p-4 pointer-events-none sm:bottom-6 sm:right-6"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={cn(
              'lifeos-enter pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur-md transition-all',
              t.type === 'success' && 'border-emerald-500/30 bg-card/95 text-foreground shadow-emerald-500/5',
              t.type === 'error' && 'border-destructive/40 bg-card/95 text-foreground shadow-destructive/5',
              t.type === 'warning' && 'border-amber-500/40 bg-card/95 text-foreground shadow-amber-500/5',
              t.type === 'info' && 'border-border/80 bg-card/95 text-foreground'
            )}
          >
            <div className="mt-0.5 shrink-0">
              {t.type === 'success' && <CheckCircle2 className="size-5 text-emerald-500" />}
              {t.type === 'error' && <AlertCircle className="size-5 text-destructive" />}
              {t.type === 'warning' && <AlertTriangle className="size-5 text-amber-500" />}
              {t.type === 'info' && <Info className="size-5 text-primary" />}
            </div>

            <div className="min-w-0 flex-1">
              {t.title && <h4 className="text-xs font-semibold">{t.title}</h4>}
              <p className="text-xs text-muted-foreground">{t.message}</p>
            </div>

            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground p-0.5"
              aria-label="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
