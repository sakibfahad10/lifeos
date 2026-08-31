'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
      setMessage('Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment variables.')
      setPending(false)
      return
    }
    const { error } = await createClient().auth.updateUser({ password })
    if (error) setMessage('Unable to update password. Please request a new reset link.')
    else {
      setMessage('Password updated.')
      setTimeout(() => router.push('/dashboard'), 700)
    }
    setPending(false)
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-border/80 bg-card p-8 shadow-xl">
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use at least 8 characters.</p>
        <label className="mt-6 flex flex-col gap-2 text-sm font-medium">
          New password
          <input value={password} onChange={event => setPassword(event.target.value)} required minLength={8} type="password" className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:ring-2 focus:ring-ring/20" />
        </label>
        <Button className="mt-5 w-full" disabled={pending}>{pending ? 'Updating…' : 'Update password'}</Button>
        {message && <p role="status" className="mt-4 text-sm text-muted-foreground">{message}</p>}
      </form>
    </main>
  )
}
