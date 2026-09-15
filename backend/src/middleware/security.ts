import type { Request, Response, NextFunction } from 'express'

/**
 * Native HTTP security headers middleware (Zero-dependency, OWASP-compliant)
 * Protects against MIME sniffing, clickjacking, XSS vulnerabilities, and information leakage.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // Prevent clickjacking by disallowing embedding in iframes from other origins
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')

  // Disable legacy browser XSS auditor which has known vulnerabilities
  res.setHeader('X-XSS-Protection', '0')

  // Control referrer information sent in HTTP requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Restrict cross-origin framing and popups
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin')

  // Restrict browser hardware/feature access
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  // HTTP Strict Transport Security (HSTS) in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  next()
}
