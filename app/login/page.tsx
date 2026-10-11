import { AuthForm } from '@/components/auth-form'
import { CalendarDays, CheckCircle2, Sparkles, Zap } from 'lucide-react'
import Link from 'next/link'

const features = [
  { icon: CalendarDays, text: 'Smart calendar with AI scheduling assistant' },
  { icon: Zap, text: 'Real-time task tracking with live countdowns' },
  { icon: Sparkles, text: 'Import schedules from documents, PDFs & images' },
  { icon: CheckCircle2, text: 'Instant notifications and overdue alerts' },
]

export default function LoginPage() {
  return (
    <main className="flex min-h-screen bg-background">
      {/* Left decorative panel */}
      <div className="relative hidden w-[45%] flex-col overflow-hidden bg-[oklch(0.50_0.16_260)] lg:flex">
        {/* Ambient glow orbs */}
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/2 -right-24 size-72 rounded-full bg-white/8 blur-3xl" />
        <div className="absolute -bottom-20 left-10 size-80 rounded-full bg-[oklch(0.70_0.16_280)]/30 blur-3xl" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: 'linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 flex flex-1 flex-col p-12">
          {/* Brand mark */}
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm shadow-lg ring-1 ring-white/30">
              <CalendarDays className="size-5 text-white" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">LifeOS</span>
              <span className="ml-2 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white/80">Pro</span>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Your life, organized</p>
            <h2 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-white">
              One workspace<br />for everything
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              LifeOS brings your calendar, tasks, and AI scheduling tools into a single, beautifully designed workspace.
            </p>

            {/* Feature list */}
            <ul className="mt-8 space-y-3.5">
              {features.map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-sm text-white/80">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                    <Icon className="size-3.5 text-white" />
                  </div>
                  {text}
                </li>
              ))}
            </ul>

            {/* Social proof badge */}
            <div className="mt-10 inline-flex items-center gap-2 rounded-2xl border border-white/20 bg-white/10 px-4 py-2.5 backdrop-blur-sm">
              <div className="flex -space-x-1.5">
                {['#60a5fa', '#34d399', '#f59e0b', '#f87171'].map((color, i) => (
                  <div
                    key={i}
                    className="size-6 rounded-full ring-2 ring-[oklch(0.50_0.16_260)]"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <p className="text-xs font-medium text-white/80">Trusted by students &amp; professionals worldwide</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-md">
          {/* Mobile brand (hidden on lg) */}
          <Link
            href="/dashboard"
            className="mb-8 flex items-center gap-2.5 lg:hidden"
          >
            <span className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <CalendarDays className="size-4" />
            </span>
            <span className="text-base font-bold tracking-tight">LifeOS</span>
          </Link>

          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to continue to your workspace.
            </p>
          </div>

          <AuthForm />

          <div className="mt-3 text-center">
            <Link
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-1.5 text-sm">
            <span className="text-muted-foreground">New to LifeOS?</span>
            <Link
              className="font-semibold text-primary hover:underline underline-offset-2"
              href="/register"
            >
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
