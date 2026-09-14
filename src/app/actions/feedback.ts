'use server'

import { createClient } from '@/lib/supabase/server'
import { emailConfigured, sendEmail } from '@/lib/email/send'

/**
 * Pilot feedback, straight to Ben's inbox.
 *
 * Deliberately not a table. During a pilot the point is that a message from
 * a real person lands where it will be read within the hour, and a database
 * row nobody is looking at is the opposite of that. Reply-To is the person
 * who wrote in, so answering is one keystroke.
 */

const TO = process.env.FEEDBACK_TO ?? 'benjamin@hicircles.com'

export async function sendFeedback(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in to send feedback.' }

  const message = ((formData.get('message') as string) ?? '').trim()
  const page = ((formData.get('page') as string) ?? '').trim().slice(0, 300)
  if (!message) return { error: 'Write something first.' }
  if (message.length > 4000) return { error: 'Keep it under 4000 characters.' }

  if (!emailConfigured()) return { error: 'Feedback is not set up yet. Text Ben instead.' }

  const { data: profile } = await supabase
    .from('profiles').select('full_name').eq('id', user.id).maybeSingle()
  const name = profile?.full_name ?? 'Someone'
  const email = user.email ?? 'unknown'

  const text = [
    `From: ${name} <${email}>`,
    page ? `Page: ${page}` : null,
    '',
    message,
  ].filter((l) => l !== null).join('\n')

  try {
    await sendEmail({
      to: TO,
      subject: `Feedback from ${name}`,
      text,
      html: `<pre style="font-family:ui-monospace,monospace;font-size:14px;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
      replyTo: email,
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not send. Try again in a minute.' }
  }

  return { ok: true }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
