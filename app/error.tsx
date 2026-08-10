'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { useEffect(() => { console.error('[v0] LifeOS route error') }, []); return <main className="flex min-h-screen items-center justify-center bg-background p-6"><div className="max-w-md text-center"><h1 className="text-2xl font-semibold">Something went wrong</h1><p className="mt-2 text-sm text-muted-foreground">We couldn&apos;t load this workspace view. Try again or return to the dashboard.</p><div className="mt-6 flex justify-center gap-3"><Button onClick={reset}>Try again</Button><a href="/dashboard" className="inline-flex h-9 items-center justify-center rounded-lg border border-input px-4 text-sm font-medium hover:bg-muted">Dashboard</a></div></div></main> }
