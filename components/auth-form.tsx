'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/user-api'
import { Button } from '@/components/ui/button'

export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    try {
      const supabase = createClient()
      const result = register
        ? await supabase.auth.signUp({ email: String(data.email), password: String(data.password), options: { data: { name: String(data.name) }, emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback` } })
        : await supabase.auth.signInWithPassword({ email: String(data.email), password: String(data.password) })
      if (result.error) {
        const message = result.error.message.toLowerCase()
        setError(message.includes('confirm') ? 'Check your email to confirm your account.' : register && message.includes('password') ? result.error.message : 'Invalid email or password.')
        return
      }
      if (register && !result.data.session) {
        setError('Account created. Check your email to confirm your account.')
        return
      }
      await getCurrentUser()
      router.replace('/dashboard')
      router.refresh()
    } catch (error) {
      console.error('[v0] Supabase auth request failed', error)
      setError('Unable to reach authentication. Check the Supabase configuration and try again.')
    } finally {
      setPending(false)
    }
  }
  return <form onSubmit={submit} className="lifeos-enter mt-6 flex flex-col gap-4">{register && <label className="flex flex-col gap-2 text-sm font-medium">Name<input name="name" required minLength={2} className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Jordan Davis" /></label>}<label className="flex flex-col gap-2 text-sm font-medium">Email<input name="email" type="email" required className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="you@example.com" /></label><label className="flex flex-col gap-2 text-sm font-medium">Password<input name="password" type="password" required minLength={8} className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="At least 8 characters" /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button type="submit" disabled={pending} className="mt-2 h-10">{pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</Button></form>
}
