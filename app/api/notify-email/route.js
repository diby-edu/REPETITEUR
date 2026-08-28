import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'
import { createClient } from '@supabase/supabase-js'

// Client admin (service role) pour lire l'email + les préférences (bypass RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const SITE = 'https://repetiteur.numerik360.com'

// type de notification -> clé de préférence
const TYPE_TO_KEY = {
  new_message: 'newMessage',
  engagement_proposed: 'bookingRequest',
  engagement_request: 'bookingRequest',
  booking_request: 'bookingRequest',
  booking_confirmed: 'bookingUpdate',
  booking_rejected: 'bookingUpdate',
  booking_cancelled: 'bookingUpdate',
  review_invite: 'bookingUpdate',
  new_review: 'reviewReceived',
  tutor_interest: 'tutorInterest',
}
// Email par défaut : ON pour les types actionnables/rares, OFF pour les fréquents.
const EMAIL_DEFAULTS = {
  bookingRequest: true, bookingUpdate: true, tutorInterest: true,
  reviewReceived: false, subscriptionExpiry: false, newMessage: false, profileViews: false,
}
// Types critiques : toujours envoyés par email.
const CRITICAL = new Set(['verification_approved', 'verification_rejected', 'doc_resubmitted'])

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
}

function makeTransport() {
  const port = Number(process.env.SMTP_PORT || 465)
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,               // 465 = SSL, 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  })
}

export async function POST(request) {
  try {
    // Sécurité : secret partagé avec le webhook Supabase
    if (request.headers.get('x-webhook-secret') !== process.env.NOTIFY_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      return NextResponse.json({ status: 'smtp_not_configured' })
    }

    const body = await request.json()
    const rec = body.record || body            // webhook Supabase : { record } ; ou payload direct
    if (!rec?.user_id || !rec?.type) return NextResponse.json({ status: 'ignored' })

    // Destinataire : email + préférences
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('email, first_name, notification_preferences')
      .eq('id', rec.user_id).single()
    if (!prof?.email) return NextResponse.json({ status: 'no_email' })

    // Respect de la préférence email
    const prefs = prof.notification_preferences || {}
    const key = TYPE_TO_KEY[rec.type]
    let wantEmail
    if (CRITICAL.has(rec.type)) wantEmail = true
    else if (key) wantEmail = prefs['email_' + key] ?? (EMAIL_DEFAULTS[key] ?? false)
    else wantEmail = false
    if (!wantEmail) return NextResponse.json({ status: 'skipped_pref' })

    const link = rec.link ? `${SITE}${rec.link}` : SITE
    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:8px">
        <h2 style="color:#111827;font-size:19px;margin:0 0 12px">${escapeHtml(rec.title)}</h2>
        <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 18px">${escapeHtml(rec.message)}</p>
        <p style="margin:0 0 8px">
          <a href="${link}" style="display:inline-block;background:#E87722;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:11px 24px;border-radius:10px">Ouvrir MonRépétiteur</a>
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:22px 0">
        <p style="font-size:12px;color:#9ca3af;line-height:1.5">Vous recevez cet email car les notifications par email sont activées pour ce type. Gérez vos préférences dans <em>Réglages → Notifications</em> sur MonRépétiteur.</p>
      </div>`

    await makeTransport().sendMail({
      from: `MonRépétiteur <${process.env.SMTP_USER}>`,
      to: prof.email,
      subject: rec.title,
      html,
    })
    return NextResponse.json({ status: 'sent' })
  } catch (err) {
    console.error('[notify-email]', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
