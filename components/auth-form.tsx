'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export function AuthForm({ register = false }: { register?: boolean }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('')
    const data = Object.fromEntries(new FormData(event.currentTarget).entries())
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/auth/${register ? 'register' : 'login'}`, { method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) })
    if (!response.ok) { const body = await response.json().catch(() => null); setError(body?.error?.message || 'Unable to continue'); setPending(false); return }
    router.push('/dashboard'); router.refresh()
  }
  return <form onSubmit={submit} className="lifeos-enter mt-6 flex flex-col gap-4"><label className="flex flex-col gap-2 text-sm font-medium">{register && 'Name'}{register && <input name="name" required minLength={2} className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="Jordan Davis" />}</label><label className="flex flex-col gap-2 text-sm font-medium">Email<input name="email" type="email" required className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="you@example.com" /></label><label className="flex flex-col gap-2 text-sm font-medium">Password<input name="password" type="password" required minLength={8} className="h-10 rounded-xl border border-input bg-background px-3 font-normal outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-ring focus:ring-2 focus:ring-ring/20" placeholder="At least 8 characters" /></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={pending} className="mt-2 h-10">{pending ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</Button></form>
}
