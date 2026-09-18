'use client'

import React from 'react'
import { AlertCircle, FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// ─── Standardized Page Header ─────────────────────────────────────────────────

export function PageHeader({
  title,
  eyebrow,
  children,
  className,
}: {
  title: string
  eyebrow?: string
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col justify-between gap-4 sm:flex-row sm:items-center', className)}>
      <div>
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/90">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

// ─── Empty State ─────────────────────────────────────────────────────────────

export function EmptyState({
  title,
  description,
  icon: Icon = FolderOpen,
  action,
  className,
}: {
  title: string
  description?: string
  icon?: React.ElementType
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'lifeos-enter flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center backdrop-blur-xs',
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/70 text-muted-foreground/70 mb-3.5 shadow-xs">
        <Icon className="size-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-xs text-muted-foreground leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ─── Error State ─────────────────────────────────────────────────────────────

export function ErrorState({
  title = 'Something went wrong',
  description = 'An error occurred while loading this data.',
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'lifeos-enter flex flex-col items-center justify-center rounded-2xl border border-destructive/25 bg-destructive/5 p-8 text-center',
        className
      )}
    >
      <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive mb-3">
        <AlertCircle className="size-5" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="mt-4 gap-1.5 text-xs"
        >
          <RefreshCw className="size-3.5" />
          Try Again
        </Button>
      )}
    </div>
  )
}

// ─── Status Badge ────────────────────────────────────────────────────────────

export type ItemStatus = 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE' | 'PROCESSING' | 'REVIEW' | 'CONFIRMED' | 'FAILED'

export function StatusBadge({ status }: { status: ItemStatus | string }) {
  const s = status.toUpperCase()
  const isGood = s === 'COMPLETED' || s === 'CONFIRMED'
  const isBad = s === 'OVERDUE' || s === 'FAILED'
  const isWarn = s === 'PROCESSING' || s === 'REVIEW'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        isGood
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : isBad
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          : isWarn
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-muted text-muted-foreground'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          isGood
            ? 'bg-emerald-500'
            : isBad
            ? 'bg-rose-500'
            : isWarn
            ? 'bg-amber-500'
            : 'bg-muted-foreground/60'
        )}
      />
      {status}
    </span>
  )
}

// ─── Priority Badge ──────────────────────────────────────────────────────────

export function PriorityBadge({ priority }: { priority: 'HIGH' | 'MEDIUM' | 'LOW' | string }) {
  const p = priority.toUpperCase()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        p === 'HIGH'
          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
          : p === 'MEDIUM'
          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          p === 'HIGH'
            ? 'bg-rose-500'
            : p === 'MEDIUM'
            ? 'bg-amber-500'
            : 'bg-slate-400'
        )}
      />
      {priority}
    </span>
  )
}
