'use client'

import { FormEvent, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState(''); const [message, setMessage] = useState(''); const [pending, setPending] = useState(false)
  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setMessage('')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      setMessage('Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.')
      setPending(false)
      return
    }
    const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
    setMessage(error ? 'Unable to send a reset email. Please try again.' : 'If an account exists, a password reset email is on its way.')
    setPending(false)
  }
  return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4"><div className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-8 shadow-xl"><Link href="/login" className="font-semibold text-primary">LifeOS</Link><h1 className="mt-10 text-2xl font-semibold">Reset your password</h1><p className="mt-2 text-sm text-muted-foreground">We&apos;ll send you a secure link to choose a new password.</p><form onSubmit={submit} className="mt-6 flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-medium">Email<input value={email} onChange={event => setEmail(event.target.value)} required type="email" className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring/20" /></label><Button disabled={pending}>{pending ? 'Sending…' : 'Send reset link'}</Button>{message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}</form></div></main>
}
