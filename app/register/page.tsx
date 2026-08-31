import { AuthForm } from '@/components/auth-form'
import { CalendarDays } from 'lucide-react'
import Link from 'next/link'

export default function RegisterPage() { return <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm"><Link href="/dashboard" className="flex items-center gap-2.5 text-lg font-semibold"><span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground"><CalendarDays className="size-4" /></span>LifeOS</Link><div className="mt-10"><h1 className="text-2xl font-semibold tracking-tight">Create your account</h1><p className="mt-2 text-sm text-muted-foreground">Start organizing the life you want.</p></div><AuthForm register /><p className="mt-6 text-center text-sm text-muted-foreground">Already have an account? <Link className="font-medium text-primary hover:underline" href="/login">Sign in</Link></p></div></main> }
