'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Bell,
  CalendarDays,
  Check,
  Clock,
  Download,
  Globe,
  Laptop,
  Loader2,
  LogOut,
  Moon,
  Palette,
  Shield,
  Sliders,
  Sparkles,
  Sun,
  UserRound,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import {
  getCurrentUser,
  getSettings,
  updateProfile,
  updateSettings,
  type LifeOSUser,
} from '@/lib/user-api'
import { applyTheme, getStoredTheme, type ThemeMode } from '@/lib/theme'
import { cn } from '@/lib/utils'

export type SettingsTabId =
  | 'preferences'
  | 'appearance'
  | 'notifications'
  | 'calendar'
  | 'ai-import'
  | 'account'

interface SettingsPageProps {
  onUpdateUser?: (u: LifeOSUser) => void
  onNavigate?: (href: string) => void
  onLogout?: () => void
}

interface WorkspaceSettings {
  theme?: ThemeMode
  weekStartsOn?: 'monday' | 'sunday'
  timezone?: string
  density?: 'normal' | 'compact'
  notifications?: {
    reminders?: boolean
    overdue?: boolean
    aiImports?: boolean
    dailyDigest?: boolean
  }
  calendarDefaults?: {
    defaultView?: 'month' | 'week' | 'day' | 'agenda'
    defaultReminderMinutes?: number
    defaultEventDuration?: number
  }
  aiDefaults?: {
    autoSelectHighConfidence?: boolean
    defaultItemType?: 'EVENT' | 'TASK'
    defaultCategory?: string
  }
}

export function SettingsPage({ onUpdateUser, onNavigate, onLogout }: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('preferences')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)

  // User state
  const [user, setUser] = useState<LifeOSUser | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')

  // Settings state
  const [theme, setTheme] = useState<ThemeMode>('system')
  const [weekStartsOn, setWeekStartsOn] = useState<'monday' | 'sunday'>('monday')
  const [timezone, setTimezone] = useState('')
  const [density, setDensity] = useState<'normal' | 'compact'>('normal')

  const [notifReminders, setNotifReminders] = useState(true)
  const [notifOverdue, setNotifOverdue] = useState(true)
  const [notifAiImports, setNotifAiImports] = useState(true)
  const [notifDailyDigest, setNotifDailyDigest] = useState(false)

  const [calDefaultView, setCalDefaultView] = useState<'month' | 'week' | 'day' | 'agenda'>('month')
  const [calReminderMinutes, setCalReminderMinutes] = useState(15)
  const [calDurationMinutes, setCalDurationMinutes] = useState(30)

  const [aiAutoSelect, setAiAutoSelect] = useState(true)
  const [aiDefaultType, setAiDefaultType] = useState<'EVENT' | 'TASK'>('EVENT')
  const [aiDefaultCategory, setAiDefaultCategory] = useState('Personal')

  // Initial snapshot for dirty check
  const [initialSnapshot, setInitialSnapshot] = useState<string>('')

  // Load user profile & settings on mount
  useEffect(() => {
    let mounted = true

    async function loadData() {
      try {
        setLoading(true)
        const [profileRes, settingsRes] = await Promise.all([
          getCurrentUser(),
          getSettings(),
        ])

        if (!mounted) return

        const userData = profileRes.data
        const rawSettings = (settingsRes.data || {}) as WorkspaceSettings

        setUser(userData)
        setName(userData.name || '')
        setEmail(userData.email || '')

        // Detect default timezone if not saved
        const detectedTz =
          rawSettings.timezone ||
          (typeof Intl !== 'undefined'
            ? Intl.DateTimeFormat().resolvedOptions().timeZone
            : 'UTC')

        const currentTheme = (rawSettings.theme || getStoredTheme()) as ThemeMode
        const currentWeekStartsOn = rawSettings.weekStartsOn || 'monday'
        const currentDensity = rawSettings.density || 'normal'

        const notifs = rawSettings.notifications || {}
        const cal = rawSettings.calendarDefaults || {}
        const ai = rawSettings.aiDefaults || {}

        setTheme(currentTheme)
        setWeekStartsOn(currentWeekStartsOn)
        setTimezone(detectedTz)
        setDensity(currentDensity)

        setNotifReminders(notifs.reminders !== false)
        setNotifOverdue(notifs.overdue !== false)
        setNotifAiImports(notifs.aiImports !== false)
        setNotifDailyDigest(Boolean(notifs.dailyDigest))

        setCalDefaultView(cal.defaultView || 'month')
        setCalReminderMinutes(cal.defaultReminderMinutes ?? 15)
        setCalDurationMinutes(cal.defaultEventDuration ?? 30)

        setAiAutoSelect(ai.autoSelectHighConfidence !== false)
        setAiDefaultType(ai.defaultItemType || 'EVENT')
        setAiDefaultCategory(ai.defaultCategory || 'Personal')

        // Snapshot to track unsaved edits
        const snapshot = JSON.stringify({
          name: userData.name || '',
          email: userData.email || '',
          theme: currentTheme,
          weekStartsOn: currentWeekStartsOn,
          timezone: detectedTz,
          density: currentDensity,
          notifReminders: notifs.reminders !== false,
          notifOverdue: notifs.overdue !== false,
          notifAiImports: notifs.aiImports !== false,
          notifDailyDigest: Boolean(notifs.dailyDigest),
          calDefaultView: cal.defaultView || 'month',
          calReminderMinutes: cal.defaultReminderMinutes ?? 15,
          calDurationMinutes: cal.defaultEventDuration ?? 30,
          aiAutoSelect: ai.autoSelectHighConfidence !== false,
          aiDefaultType: ai.defaultItemType || 'EVENT',
          aiDefaultCategory: ai.defaultCategory || 'Personal',
        })
        setInitialSnapshot(snapshot)
      } catch (err) {
        console.error('Failed to load settings:', err)
        toast.error('Unable to load current settings.')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void loadData()
    return () => {
      mounted = false
    }
  }, [])

  // Listen to external theme changes (like header toggle button)
  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme?: ThemeMode }>
      if (customEvent.detail?.theme && customEvent.detail.theme !== theme) {
        setTheme(customEvent.detail.theme)
      }
    }
    window.addEventListener('lifeos:theme-change', handleThemeChange)
    return () => window.removeEventListener('lifeos:theme-change', handleThemeChange)
  }, [theme])

  // Compute current state snapshot
  const currentSnapshot = useMemo(() => {
    return JSON.stringify({
      name,
      email,
      theme,
      weekStartsOn,
      timezone,
      density,
      notifReminders,
      notifOverdue,
      notifAiImports,
      notifDailyDigest,
      calDefaultView,
      calReminderMinutes,
      calDurationMinutes,
      aiAutoSelect,
      aiDefaultType,
      aiDefaultCategory,
    })
  }, [
    name,
    email,
    theme,
    weekStartsOn,
    timezone,
    density,
    notifReminders,
    notifOverdue,
    notifAiImports,
    notifDailyDigest,
    calDefaultView,
    calReminderMinutes,
    calDurationMinutes,
    aiAutoSelect,
    aiDefaultType,
    aiDefaultCategory,
  ])

  const isDirty = initialSnapshot !== '' && initialSnapshot !== currentSnapshot

  // Handle immediate visual theme switch
  const handleSelectTheme = (newTheme: ThemeMode) => {
    setTheme(newTheme)
    applyTheme(newTheme)
  }

  // Save all settings to API
  const handleSave = async () => {
    setSaving(true)
    try {
      // 1. Update profile if changed
      let updatedUserObj = user
      if (user && (name !== user.name || email !== user.email)) {
        const profileRes = await updateProfile({ name: name.trim(), email: email.trim().toLowerCase() })
        updatedUserObj = profileRes.data
        setUser(updatedUserObj)
        if (onUpdateUser) onUpdateUser(updatedUserObj)
      }

      // 2. Update workspace settings
      const settingsPayload: WorkspaceSettings = {
        theme,
        weekStartsOn,
        timezone: timezone.trim(),
        density,
        notifications: {
          reminders: notifReminders,
          overdue: notifOverdue,
          aiImports: notifAiImports,
          dailyDigest: notifDailyDigest,
        },
        calendarDefaults: {
          defaultView: calDefaultView,
          defaultReminderMinutes: Number(calReminderMinutes),
          defaultEventDuration: Number(calDurationMinutes),
        },
        aiDefaults: {
          autoSelectHighConfidence: aiAutoSelect,
          defaultItemType: aiDefaultType,
          defaultCategory: aiDefaultCategory,
        },
      }

      await updateSettings(settingsPayload as Record<string, unknown>)
      applyTheme(theme)

      setInitialSnapshot(currentSnapshot)
      toast.success('Workspace preferences saved successfully.')
    } catch (err: unknown) {
      console.error('Error saving settings:', err)
      const message =
        err instanceof Error ? err.message : 'Could not save settings. Please check your inputs.'
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  // Reset unsaved changes to initial snapshot
  const handleDiscard = () => {
    if (!initialSnapshot) return
    try {
      const data = JSON.parse(initialSnapshot)
      setName(data.name)
      setEmail(data.email)
      setTheme(data.theme)
      applyTheme(data.theme)
      setWeekStartsOn(data.weekStartsOn)
      setTimezone(data.timezone)
      setDensity(data.density)
      setNotifReminders(data.notifReminders)
      setNotifOverdue(data.notifOverdue)
      setNotifAiImports(data.notifAiImports)
      setNotifDailyDigest(data.notifDailyDigest)
      setCalDefaultView(data.calDefaultView)
      setCalReminderMinutes(data.calReminderMinutes)
      setCalDurationMinutes(data.calDurationMinutes)
      setAiAutoSelect(data.aiAutoSelect)
      setAiDefaultType(data.aiDefaultType)
      setAiDefaultCategory(data.aiDefaultCategory)
      toast.info('Unsaved changes discarded.')
    } catch {
      // Ignore
    }
  }

  // Export workspace data as a downloadable JSON file
  const handleExportData = async () => {
    setExporting(true)
    try {
      const exportPayload = {
        exportDate: new Date().toISOString(),
        user: { id: user?.id, name, email },
        settings: {
          theme,
          weekStartsOn,
          timezone,
          density,
          notifications: {
            reminders: notifReminders,
            overdue: notifOverdue,
            aiImports: notifAiImports,
            dailyDigest: notifDailyDigest,
          },
          calendarDefaults: {
            defaultView: calDefaultView,
            defaultReminderMinutes: calReminderMinutes,
            defaultEventDuration: calDurationMinutes,
          },
          aiDefaults: {
            autoSelectHighConfidence: aiAutoSelect,
            defaultItemType: aiDefaultType,
            defaultCategory: aiDefaultCategory,
          },
        },
      }

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lifeos-backup-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Workspace backup downloaded successfully.')
    } catch (err) {
      console.error('Export error:', err)
      toast.error('Failed to export data.')
    } finally {
      setExporting(false)
    }
  }

  const navItems = [
    { id: 'preferences', label: 'Preferences', icon: Sliders, desc: 'General & Profile' },
    { id: 'appearance', label: 'Appearance', icon: Palette, desc: 'Theme & Display' },
    { id: 'notifications', label: 'Notifications', icon: Bell, desc: 'Alerts & Reminders' },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays, desc: 'Schedule & Views' },
    { id: 'ai-import', label: 'AI Import', icon: Sparkles, desc: 'Smart Ingestion' },
    { id: 'account', label: 'Account & Data', icon: Shield, desc: 'Security & Backup' },
  ] as const

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center text-xs text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin text-primary" />
        Loading settings…
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-20">
      {/* Header section */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">Configuration</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Workspace Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your schedule preferences, visual interface, and intelligent workflow tools.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        {/* Sidebar Navigation */}
        <aside className="flex flex-row gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
          {navItems.map(item => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  'group flex items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium transition-all whitespace-nowrap lg:whitespace-normal',
                  active
                    ? 'bg-primary/10 text-primary shadow-2xs font-semibold'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon
                  className={cn(
                    'size-4 shrink-0 transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                <div className="flex flex-col">
                  <span>{item.label}</span>
                  <span className="hidden text-[10px] font-normal text-muted-foreground/75 lg:inline-block">
                    {item.desc}
                  </span>
                </div>
              </button>
            )
          })}
        </aside>

        {/* Tab Content Panes */}
        <main className="space-y-6">
          {/* TAB 1: PREFERENCES */}
          {activeTab === 'preferences' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
                <div className="flex items-center justify-between border-b border-border/60 pb-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">General Profile</h2>
                    <p className="text-xs text-muted-foreground">
                      Your identity and default timezone across the LifeOS workspace.
                    </p>
                  </div>
                  {onNavigate && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onNavigate('/profile')}
                      className="gap-1.5"
                    >
                      <UserRound className="size-3" />
                      View Full Profile
                    </Button>
                  )}
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                    Display Name
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Your name"
                      className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                    Email Address
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                    />
                  </label>

                  <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground sm:col-span-2">
                    <span className="flex items-center gap-1.5">
                      <Globe className="size-3.5 text-primary" />
                      Timezone
                    </span>
                    <div className="flex gap-2">
                      <input
                        value={timezone}
                        onChange={e => setTimezone(e.target.value)}
                        placeholder="e.g. America/New_York or Asia/Dhaka"
                        className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-xs outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const autoTz = Intl.DateTimeFormat().resolvedOptions().timeZone
                          setTimezone(autoTz)
                          toast.info(`Timezone auto-detected: ${autoTz}`)
                        }}
                      >
                        Auto-detect
                      </Button>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Used for scheduling deadlines, reminders, and calendar event conversions.
                    </span>
                  </label>
                </div>
              </div>

              {/* Quick Navigation Card */}
              <div className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs">
                <h3 className="text-sm font-semibold text-foreground">Next steps</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Need to fine-tune other parts of your workspace?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('appearance')}
                    className="gap-1.5"
                  >
                    <Palette className="size-3.5 text-primary" />
                    Configure Appearance
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('notifications')}
                    className="gap-1.5"
                  >
                    <Bell className="size-3.5 text-primary" />
                    Notification Alerts
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('calendar')}
                    className="gap-1.5"
                  >
                    <CalendarDays className="size-3.5 text-primary" />
                    Calendar Rules
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Theme & Interface</h2>
                  <p className="text-xs text-muted-foreground">
                    Choose how LifeOS looks on your device. Changes apply in real-time.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* System Theme Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectTheme('system')}
                    className={cn(
                      'relative flex flex-col rounded-xl border p-4 text-left transition-all',
                      theme === 'system'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border/80 bg-card hover:border-border hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Laptop className="size-4" />
                      </div>
                      {theme === 'system' && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <span className="mt-3 text-xs font-semibold text-foreground">System Default</span>
                    <span className="mt-0.5 text-[11px] text-muted-foreground">
                      Matches your operating system color scheme automatically.
                    </span>
                  </button>

                  {/* Light Theme Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectTheme('light')}
                    className={cn(
                      'relative flex flex-col rounded-xl border p-4 text-left transition-all',
                      theme === 'light'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border/80 bg-card hover:border-border hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                        <Sun className="size-4" />
                      </div>
                      {theme === 'light' && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <span className="mt-3 text-xs font-semibold text-foreground">Light Mode</span>
                    <span className="mt-0.5 text-[11px] text-muted-foreground">
                      Clean and high-contrast daylight appearance.
                    </span>
                  </button>

                  {/* Dark Theme Card */}
                  <button
                    type="button"
                    onClick={() => handleSelectTheme('dark')}
                    className={cn(
                      'relative flex flex-col rounded-xl border p-4 text-left transition-all',
                      theme === 'dark'
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border/80 bg-card hover:border-border hover:bg-muted/40'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Moon className="size-4" />
                      </div>
                      {theme === 'dark' && (
                        <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="size-3" />
                        </span>
                      )}
                    </div>
                    <span className="mt-3 text-xs font-semibold text-foreground">Dark Mode</span>
                    <span className="mt-0.5 text-[11px] text-muted-foreground">
                      Deep slate aesthetic designed for low-light environments.
                    </span>
                  </button>
                </div>

                {/* Density Options */}
                <div className="mt-6 border-t border-border/60 pt-5">
                  <h3 className="text-xs font-semibold text-foreground">Information Density</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Adjust the spacing and compactness of calendar cells and task lists.
                  </p>
                  <div className="mt-3 flex gap-3">
                    <label
                      className={cn(
                        'flex flex-1 cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition-all',
                        density === 'normal'
                          ? 'border-primary bg-primary/5 font-medium text-foreground ring-1 ring-primary'
                          : 'border-border/80 bg-background text-muted-foreground hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="density"
                          checked={density === 'normal'}
                          onChange={() => setDensity('normal')}
                          className="text-primary focus:ring-primary"
                        />
                        <span>Comfortable (Default)</span>
                      </div>
                    </label>

                    <label
                      className={cn(
                        'flex flex-1 cursor-pointer items-center justify-between rounded-xl border p-3 text-xs transition-all',
                        density === 'compact'
                          ? 'border-primary bg-primary/5 font-medium text-foreground ring-1 ring-primary'
                          : 'border-border/80 bg-background text-muted-foreground hover:bg-muted/30'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="density"
                          checked={density === 'compact'}
                          onChange={() => setDensity('compact')}
                          className="text-primary focus:ring-primary"
                        />
                        <span>Compact (Dense)</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Alert Preferences</h2>
                  <p className="text-xs text-muted-foreground">
                    Control which updates and reminders trigger alerts in your workspace.
                  </p>
                </div>

                <div className="mt-5 divide-y divide-border/60">
                  {/* Reminders Toggle */}
                  <div className="flex items-center justify-between py-4">
                    <div className="pr-4">
                      <p className="text-xs font-semibold text-foreground">Upcoming Reminders</p>
                      <p className="text-[11px] text-muted-foreground">
                        Receive timed notifications before scheduled calendar events and pending tasks.
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={notifReminders}
                        onChange={e => setNotifReminders(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-card after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:bg-primary-foreground peer-focus:outline-none" />
                    </label>
                  </div>

                  {/* Overdue Alerts Toggle */}
                  <div className="flex items-center justify-between py-4">
                    <div className="pr-4">
                      <p className="text-xs font-semibold text-foreground">Overdue Task Warnings</p>
                      <p className="text-[11px] text-muted-foreground">
                        Highlight and notify when deadlines have passed without completion.
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={notifOverdue}
                        onChange={e => setNotifOverdue(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-card after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:bg-primary-foreground peer-focus:outline-none" />
                    </label>
                  </div>

                  {/* AI Import Notifications */}
                  <div className="flex items-center justify-between py-4">
                    <div className="pr-4">
                      <p className="text-xs font-semibold text-foreground">AI Import Ingestion Updates</p>
                      <p className="text-[11px] text-muted-foreground">
                        Get alerted when syllabus, image, or natural text extraction completes.
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={notifAiImports}
                        onChange={e => setNotifAiImports(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-card after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:bg-primary-foreground peer-focus:outline-none" />
                    </label>
                  </div>

                  {/* Daily Digest */}
                  <div className="flex items-center justify-between py-4">
                    <div className="pr-4">
                      <p className="text-xs font-semibold text-foreground">Morning Briefing Digest</p>
                      <p className="text-[11px] text-muted-foreground">
                        Show a summary of high-priority agenda items upon first opening LifeOS each day.
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={notifDailyDigest}
                        onChange={e => setNotifDailyDigest(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-card after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:bg-primary-foreground peer-focus:outline-none" />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CALENDAR */}
          {activeTab === 'calendar' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Calendar & Scheduling</h2>
                  <p className="text-xs text-muted-foreground">
                    Customize day layout, default view modes, and event intervals.
                  </p>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {/* First day of week */}
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                    Start Week On
                    <select
                      value={weekStartsOn}
                      onChange={e => setWeekStartsOn(e.target.value as 'monday' | 'sunday')}
                      className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="monday">Monday (ISO standard)</option>
                      <option value="sunday">Sunday (US standard)</option>
                    </select>
                  </label>

                  {/* Default calendar view */}
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                    Default View
                    <select
                      value={calDefaultView}
                      onChange={e =>
                        setCalDefaultView(e.target.value as 'month' | 'week' | 'day' | 'agenda')
                      }
                      className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="month">Month Grid</option>
                      <option value="week">Week Columns</option>
                      <option value="day">Single Day</option>
                      <option value="agenda">Agenda List</option>
                    </select>
                  </label>

                  {/* Default reminder lead time */}
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                    <span className="flex items-center gap-1.5">
                      <Clock className="size-3.5 text-primary" />
                      Default Reminder Offset
                    </span>
                    <select
                      value={calReminderMinutes}
                      onChange={e => setCalReminderMinutes(Number(e.target.value))}
                      className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="0">At time of event (0m)</option>
                      <option value="5">5 minutes before</option>
                      <option value="10">10 minutes before</option>
                      <option value="15">15 minutes before (Default)</option>
                      <option value="30">30 minutes before</option>
                      <option value="60">1 hour before</option>
                    </select>
                  </label>

                  {/* Default event duration */}
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                    Default Event Duration
                    <select
                      value={calDurationMinutes}
                      onChange={e => setCalDurationMinutes(Number(e.target.value))}
                      className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes (Standard)</option>
                      <option value="45">45 minutes</option>
                      <option value="60">60 minutes (1 hour)</option>
                      <option value="90">90 minutes</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: AI IMPORT */}
          {activeTab === 'ai-import' && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
                <div>
                  <h2 className="text-base font-semibold text-foreground">AI Import & Ingestion</h2>
                  <p className="text-xs text-muted-foreground">
                    Preset behaviors when parsing unstructured schedules, images, or documents.
                  </p>
                </div>

                <div className="mt-5 space-y-4">
                  {/* Auto-select toggle */}
                  <div className="flex items-center justify-between rounded-xl border border-border/70 p-4">
                    <div className="pr-4">
                      <p className="text-xs font-semibold text-foreground">
                        Auto-select High Confidence Items
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Automatically check items parsed with high accuracy so you can confirm with one click.
                      </p>
                    </div>
                    <label className="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        checked={aiAutoSelect}
                        onChange={e => setAiAutoSelect(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div className="peer h-5 w-9 rounded-full bg-muted after:absolute after:top-[2px] after:left-[2px] after:size-4 after:rounded-full after:bg-card after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:bg-primary-foreground peer-focus:outline-none" />
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Default Type */}
                    <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                      Default Item Classification
                      <select
                        value={aiDefaultType}
                        onChange={e => setAiDefaultType(e.target.value as 'EVENT' | 'TASK')}
                        className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      >
                        <option value="EVENT">Calendar Event (Scheduled time block)</option>
                        <option value="TASK">Workspace Task (Actionable item)</option>
                      </select>
                    </label>

                    {/* Default Category */}
                    <label className="flex flex-col gap-1.5 text-xs font-medium text-foreground">
                      Default Category Tag
                      <select
                        value={aiDefaultCategory}
                        onChange={e => setAiDefaultCategory(e.target.value)}
                        className="h-9 rounded-lg border border-input bg-background px-3 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      >
                        <option value="Personal">Personal</option>
                        <option value="Work">Work</option>
                        <option value="Study">Study / Academics</option>
                        <option value="Routine">Routine / Habit</option>
                        <option value="Meeting">Meeting</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ACCOUNT & DATA */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              {/* Account summary */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
                <h2 className="text-base font-semibold text-foreground">Active Account</h2>
                <p className="text-xs text-muted-foreground">
                  Your workspace account credentials and connection status.
                </p>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-border/70 bg-muted/20 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-sm">
                      {(user?.name || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{user?.name || 'User'}</p>
                      <p className="text-[11px] text-muted-foreground">{user?.email || 'No email'}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Active Session
                  </span>
                </div>
              </div>

              {/* Data Export Card */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-xs">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Export Workspace Data</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Download a complete JSON snapshot of your preferences and configurations.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void handleExportData()}
                    disabled={exporting}
                    className="gap-1.5"
                  >
                    {exporting ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Download className="size-3.5" />
                    )}
                    Export JSON
                  </Button>
                </div>
              </div>

              {/* Session Sign Out */}
              {onLogout && (
                <div className="rounded-2xl border border-destructive/25 bg-destructive/5 p-6">
                  <h3 className="text-sm font-semibold text-destructive">Account Session</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Sign out of your active session on this device.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 border-destructive/30 text-destructive hover:bg-destructive/10"
                    onClick={onLogout}
                  >
                    <LogOut className="mr-1.5 size-3.5" />
                    Sign out of LifeOS
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Sticky / Bottom Save Changes Bar */}
          <div
            className={cn(
              'flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm transition-all',
              isDirty
                ? 'border-primary/50 bg-primary/5'
                : 'border-border/80 bg-card/60'
            )}
          >
            <div className="text-xs">
              {isDirty ? (
                <span className="font-semibold text-primary">
                  You have unsaved changes in your preferences.
                </span>
              ) : (
                <span className="text-muted-foreground">All preferences are saved and up to date.</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleDiscard}
                  disabled={saving}
                >
                  Discard
                </Button>
              )}
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || !user}
                className="gap-1.5 shadow-xs"
              >
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                {saving ? 'Saving changes…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
