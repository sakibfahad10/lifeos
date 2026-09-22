import { createTransport, type Transporter } from 'nodemailer'

interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (host && user && pass) {
    transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })
  } else {
    // Development fallback transport: logs email structure and captures payload safely
    transporter = createTransport({
      jsonTransport: true,
    })
  }

  return transporter
}

export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || '"LifeOS Alerts" <alerts@lifeos.local>'
    const transport = getTransporter()
    const info = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    })

    const messageId = info.messageId || (typeof info.message === 'string' ? info.message : 'local-email-' + Date.now())
    console.log(`[EmailService] Email sent to ${options.to} (Subject: "${options.subject}") - MessageID: ${messageId}`)
    return { success: true, messageId }
  } catch (err: any) {
    console.error(`[EmailService] Failed to send email to ${options.to}:`, err?.message || err)
    return { success: false, error: err?.message || 'Failed to dispatch email' }
  }
}

export async function sendAlertEmail(params: {
  to: string
  userName?: string
  itemTitle: string
  itemType: string
  itemTime: string
  alertSeverity: string
  message: string
  actionUrl?: string
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, userName = 'Friend', itemTitle, itemType, itemTime, alertSeverity, message, actionUrl } = params
  const isCritical = alertSeverity.toUpperCase() === 'CRITICAL'
  const isImportant = alertSeverity.toUpperCase() === 'IMPORTANT'

  const badgeColor = isCritical ? '#dc2626' : isImportant ? '#ea580c' : '#2563eb'
  const badgeBg = isCritical ? '#fef2f2' : isImportant ? '#fff7ed' : '#eff6ff'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>LifeOS Alert: ${itemTitle}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <tr>
      <td style="padding: 24px 32px; background: linear-gradient(135deg, #0f172a, #1e293b); color: #ffffff;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <span style="font-size: 20px; font-weight: 700; letter-spacing: -0.5px; color: #ffffff;">LifeOS</span>
              <span style="font-size: 12px; color: #94a3b8; margin-left: 8px; text-transform: uppercase; letter-spacing: 1px;">Alert Engine</span>
            </td>
            <td align="right">
              <span style="display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; background-color: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor};">
                ${alertSeverity}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- Body -->
    <tr>
      <td style="padding: 32px;">
        <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #0f172a;">
          ${itemTitle}
        </h2>
        <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #475569;">
          ${message}
        </p>

        <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <table width="100%" border="0" cellspacing="0" cellpadding="4" style="font-size: 13px; color: #334155;">
            <tr>
              <td width="100" style="color: #64748b; font-weight: 500;">Type:</td>
              <td style="font-weight: 600; text-transform: uppercase;">${itemType}</td>
            </tr>
            <tr>
              <td style="color: #64748b; font-weight: 500;">Scheduled for:</td>
              <td style="font-weight: 600;">${itemTime}</td>
            </tr>
          </table>
        </div>

        ${actionUrl ? `
        <div style="text-align: center; margin: 32px 0 16px;">
          <a href="${actionUrl}" style="display: inline-block; padding: 12px 28px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
            View in LifeOS
          </a>
        </div>
        ` : ''}
      </td>
    </tr>

    <!-- Footer -->
    <tr>
      <td style="padding: 20px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
        Sent to ${userName} by LifeOS Unified Alert Engine. To adjust quiet hours or channel preferences, visit Settings in your workspace.
      </td>
    </tr>
  </table>
</body>
</html>
`

  return sendEmail({
    to,
    subject: `[${alertSeverity}] ${itemTitle} - LifeOS Alert`,
    html,
  })
}

export async function sendDailyDigestEmail(params: {
  to: string
  userName?: string
  dateStr: string
  tasks: Array<{ title: string; priority: string; status: string }>
  events: Array<{ title: string; startAt: string }>
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, userName = 'Friend', dateStr, tasks, events } = params

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>LifeOS Daily Digest</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; background-color: #f8fafc; padding: 24px; color: #0f172a;">
  <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; padding: 32px;">
    <h1 style="font-size: 22px; font-weight: 700; margin-top: 0;">Morning Briefing - ${dateStr}</h1>
    <p style="color: #64748b; font-size: 14px;">Good morning, ${userName}! Here is your schedule and focus for today:</p>
    
    <h3 style="font-size: 15px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">📅 Today's Events (${events.length})</h3>
    ${events.length === 0 ? '<p style="font-size: 13px; color: #94a3b8;">No scheduled events today.</p>' : ''}
    <ul style="font-size: 13px; color: #334155; padding-left: 20px;">
      ${events.map(e => `<li><strong>${e.title}</strong> at ${e.startAt}</li>`).join('')}
    </ul>

    <h3 style="font-size: 15px; margin-top: 24px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">✅ Key Tasks (${tasks.length})</h3>
    ${tasks.length === 0 ? '<p style="font-size: 13px; color: #94a3b8;">All clear on tasks today!</p>' : ''}
    <ul style="font-size: 13px; color: #334155; padding-left: 20px;">
      ${tasks.map(t => `<li><strong>${t.title}</strong> [Priority: ${t.priority}]</li>`).join('')}
    </ul>
    
    <div style="margin-top: 32px; font-size: 12px; color: #94a3b8; text-align: center;">
      LifeOS Daily Digest • Open your workspace to plan ahead.
    </div>
  </div>
</body>
</html>
`

  return sendEmail({
    to,
    subject: `☀️ Your LifeOS Daily Digest for ${dateStr}`,
    html,
  })
}
