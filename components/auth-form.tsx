'use client'

import { FormEvent, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, Check, CheckCircle2, Copy, Loader2, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentUser } from '@/lib/user-api'
import { Button } from '@/components/ui/button'

const DEMO_EMAIL = 'demo@lifeos.app'
const DEMO_PASSWORD = 'DemoPassword123!'

export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect') || '/dashboard'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [pending, setPending] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyCredentials = () => {
    navigator.clipboard.writeText(`Email: ${DEMO_EMAIL}\nPassword: ${DEMO_PASSWORD}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const fillDemo = () => {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  const loginAsDemo = async () => {
    setError('')
    setSuccess('')
    setDemoLoading(true)
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseKey || supabaseKey.includes('placeholder')) {
        setError('Authentication service is not configured. Please verify environment variables.')
        setDemoLoading(false)
        return
      }

      const supabase = createClient()
      const result = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      })

      if (result.error) {
        setError(result.error.message || 'Invalid demo credentials. Please try again.')
        return
      }

      await getCurrentUser().catch(() => undefined)
      router.replace(redirectPath)
      router.refresh()
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in with demo account.')
    } finally {
      setDemoLoading(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess('')

    // Client-side validation
    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (register) {
      if (!name.trim()) {
        setError('Please enter your full name.')
        return
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.')
        return
      }
    }

    setPending(true)

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      if (!supabaseUrl || supabaseUrl.includes('placeholder') || !supabaseKey || supabaseKey.includes('placeholder')) {
        setError('Authentication service is not configured. Please verify environment variables.')
        setPending(false)
        return
      }

      const supabase = createClient()
      const result = register
        ? await supabase.auth.signUp({
            email: trimmedEmail,
            password,
            options: {
              data: { name: name.trim() },
              emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth/callback`,
            },
          })
        : await supabase.auth.signInWithPassword({
            email: trimmedEmail,
            password,
          })

      if (result.error) {
        const message = result.error.message
        if (message.toLowerCase().includes('confirm') || message.toLowerCase().includes('verified')) {
          setSuccess('Account created! Please check your email to confirm your account before signing in.')
        } else if (message.toLowerCase().includes('invalid login credentials')) {
          setError('Invalid email or password. Please check your credentials and try again.')
        } else {
          setError(message)
        }
        return
      }

      if (register && !result.data.session) {
        setSuccess('Account created successfully! Please check your email to verify your account.')
        return
      }

      // Sync user profile to LifeOS database
      await getCurrentUser().catch(() => undefined)

      router.replace(redirectPath)
      router.refresh()
    } catch (err: any) {
      console.error('[LifeOS Auth] Request failed', err)
      setError(err?.message || 'Unable to connect to authentication service. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="lifeos-enter mt-6 flex flex-col gap-4">
      {!register && (
        <div className="rounded-2xl border border-primary/25 bg-gradient-to-b from-primary/10 to-primary/5 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Sparkles className="size-3.5" />
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">Demo Account</span>
            </div>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">Instant Access</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Explore the complete LifeOS workspace with pre-populated tasks, calendar schedule, and AI features.
          </p>

          <div className="mt-3 flex items-center justify-between rounded-xl border border-border/70 bg-background/95 px-3 py-2 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="font-mono font-medium text-foreground">{DEMO_EMAIL}</span>
              <span className="hidden text-muted-foreground/50 sm:inline">•</span>
              <span className="font-mono text-muted-foreground">{DEMO_PASSWORD}</span>
            </div>
            <button
              type="button"
              onClick={copyCredentials}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition-colors"
              title="Copy credentials"
            >
              {copied ? (
                <>
                  <Check className="size-3 text-emerald-600" />
                  <span className="text-emerald-600 font-semibold">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={pending || demoLoading}
              onClick={loginAsDemo}
              className="flex-1 h-9 text-xs font-semibold gap-1.5 shadow-sm"
            >
              {demoLoading ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Entering Demo…</span>
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  <span>Try Demo (1-Click Login)</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || demoLoading}
              onClick={fillDemo}
              className="h-9 text-xs"
            >
              Auto-fill
            </Button>
          </div>

          <div className="relative my-3 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/60" /></div>
            <span className="relative bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">or sign in with your email</span>
          </div>
        </div>
      )}

      {register && (
        <label className="flex flex-col gap-2 text-sm font-medium">
          Full name
          <input
            name="name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            disabled={pending}
            className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
            placeholder="Jordan Davis"
          />
        </label>
      )}

      <label className="flex flex-col gap-2 text-sm font-medium">
        Email address
        <input
          name="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          disabled={pending}
          className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
          placeholder="you@example.com"
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={8}
          disabled={pending}
          className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
          placeholder="At least 8 characters"
        />
      </label>

      {register && (
        <label className="flex flex-col gap-2 text-sm font-medium">
          Confirm password
          <input
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            disabled={pending}
            className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:opacity-50"
            placeholder="Re-enter your password"
          />
        </label>
      )}

      {error && (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="status" className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <Button type="submit" disabled={pending} className="mt-2 h-10 w-full">
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            <span>{register ? 'Creating account…' : 'Signing in…'}</span>
          </>
        ) : (
          register ? 'Create account' : 'Sign in'
        )}
      </Button>
    </form>
  )
}
