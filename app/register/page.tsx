import { AuthForm } from '@/components/auth-form'
import { CalendarDays, LayoutDashboard, Sparkles, TrendingUp } from 'lucide-react'
import Link from 'next/link'

const highlights = [
  { icon: CalendarDays, label: 'Smart Calendar', desc: 'AI-powered scheduling and conflict detection' },
  { icon: LayoutDashboard, label: 'Command Center', desc: 'Track all your tasks and events in one place' },
  { icon: Sparkles, label: 'AI Import', desc: 'Extract schedules from documents and images' },
  { icon: TrendingUp, label: 'Progress Tracking', desc: 'Stay on top of deadlines and completions' },
]

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen bg-background">
      {/* Left decorative panel */}
      <div className="relative hidden w-[45%] flex-col overflow-hidden bg-[oklch(0.50_0.16_260)] lg:flex">
        {/* Ambient glow orbs */}
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute top-1/3 -right-24 size-72 rounded-full bg-[oklch(0.70_0.16_300)]/20 blur-3xl" />
        <div className="absolute -bottom-20 left-10 size-80 rounded-full bg-white/8 blur-3xl" />

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

          <div className="mt-auto">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Get started for free</p>
            <h2 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-white">
              Take control<br />of your time
            </h2>
            <p className="mt-4 text-base leading-relaxed text-white/70">
              Join thousands who use LifeOS to manage their academic and professional schedules effortlessly.
            </p>

            {/* Feature grid */}
            <div className="mt-8 grid grid-cols-2 gap-3">
              {highlights.map(({ icon: Icon, label, desc }) => (
                <div
                  key={label}
                  className="rounded-xl border border-white/15 bg-white/10 p-3.5 backdrop-blur-sm"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-white/15">
                    <Icon className="size-4 text-white" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-white/60">{desc}</p>
                </div>
              ))}
            </div>

            {/* Testimonial */}
            <div className="mt-8 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs italic leading-relaxed text-white/75">
                &ldquo;LifeOS completely changed how I manage my university schedule. The AI import feature saved me hours of manual entry.&rdquo;
              </p>
              <p className="mt-2.5 text-[11px] font-semibold text-white/60">— Student, Computer Science</p>
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
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your account</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Start organizing the life you want — it&apos;s free.
            </p>
          </div>

          <AuthForm register />

          <div className="mt-8 flex items-center justify-center gap-1.5 text-sm">
            <span className="text-muted-foreground">Already have an account?</span>
            <Link
              className="font-semibold text-primary hover:underline underline-offset-2"
              href="/login"
            >
              Sign in
            </Link>
          </div>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground/70">
            By creating an account you agree to our{' '}
            <span className="text-muted-foreground underline underline-offset-2 cursor-pointer hover:text-foreground transition-colors">Terms of Service</span>
            {' '}and{' '}
            <span className="text-muted-foreground underline underline-offset-2 cursor-pointer hover:text-foreground transition-colors">Privacy Policy</span>.
          </p>
        </div>
      </div>
    </main>
  )
}
