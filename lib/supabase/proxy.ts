import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PATHS = ['/dashboard', '/calendar', '/tasks', '/ai-import', '/notifications', '/settings', '/profile']
const AUTH_PATHS = ['/login', '/register', '/forgot-password']

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key || url.includes('placeholder')) {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })
    const { data: { user } } = await supabase.auth.getUser()
    const { pathname } = request.nextUrl

    // If unauthenticated and accessing protected path -> redirect to login
    if (!user && PROTECTED_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`))) {
      const redirectUrl = new URL('/login', request.url)
      redirectUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // If authenticated and accessing login or register -> redirect to dashboard
    if (user && AUTH_PATHS.includes(pathname)) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  } catch (err) {
    console.error('Supabase session update failed:', err)
  }
  return response
}
