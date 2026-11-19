'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { emailConfigured, sendEmail } from '@/lib/email/send'
import { reportHtml } from '@/lib/email/internal'
import { REPORT_REASONS, reasonLabel, type ReportTarget } from '@/lib/reports'

/**
 * Block and report. The rules live in the database (safety-2026-11-18.sql):
 * these turn its answers into sentences and keep the pages fresh.
 */

const TARGETS: ReportTarget[] = ['user', 'post', 'comment', 'circle']
const REASONS: string[] = REPORT_REASONS.map((r) => r.value)

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hicircles.com'
const ADMIN_TO = process.env.FEEDBACK_TO ?? 'benjamin@hicircles.com'

function refreshSocialPages(otherUserId?: string) {
  revalidatePath('/home')
  revalidatePath('/messages')
  revalidatePath('/profile')
  if (otherUserId) {
    revalidatePath(`/profile/${otherUserId}`)
    revalidatePath(`/messages/${otherUserId}`)
  }
  revalidatePath('/', 'layout') // unread badge
}

export async function blockUser(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in first.' }

  const target = formData.get('user_id') as string
  const { error } = await supabase.rpc('block_user', { p_target: target })
  if (error) return { error: 'Could not block. Try again.' }

  refreshSocialPages(target)
  return { ok: true }
}

export async function unblockUser(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const target = formData.get('user_id') as string
  await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', target)

  refreshSocialPages(target)
}

export async function fileReport(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in to report.' }

  const targetType = formData.get('target_type') as ReportTarget
  const targetId = formData.get('target_id') as string
  const reason = formData.get('reason') as string
  const details = ((formData.get('details') as string) ?? '').trim()

  if (!TARGETS.includes(targetType) || !targetId) return { error: 'Nothing to report.' }
  if (!REASONS.includes(reason)) return { error: 'Pick a reason.' }
  if (details.length > 2000) return { error: 'Keep it under 2000 characters.' }

  const { data, error } = await supabase.rpc('file_report', {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_details: details || null,
  })
  if (error) {
    // 54000 is the function's hourly limit.
    return { error: error.code === '54000' ? 'You have sent a lot of reports. Try again in an hour.' : 'Could not send the report. Try again.' }
  }
  const filed = ((data ?? []) as { report_id: string; is_new: boolean }[])[0]
  const reportId = filed?.report_id

  // The report is already safe in the database. The email is so it gets
  // read today rather than whenever someone next opens /admin, and its
  // failure must not turn a filed report into an error. Re-filing the same
  // thing updates the open report and sends nothing.
  if (filed?.is_new && emailConfigured()) {
    const label = reasonLabel(reason)
    const text = [
      `A ${targetType} was reported: ${label}.`,
      details ? `\n"${details}"` : null,
      `\nReview it at ${SITE}/admin (report ${reportId}).`,
    ].filter((l) => l !== null).join('\n')
    try {
      await sendEmail({
        to: ADMIN_TO,
        subject: `Report: ${targetType}, ${label.toLowerCase()}`,
        text,
        html: reportHtml({ targetType, label, details: details || null, reportId: reportId ?? null }),
      })
    } catch {
      // Logged by Resend's side if anywhere; the admin page still lists it.
    }
  }

  return { ok: true }
}

export async function resolveReport(formData: FormData): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Sign in first.' }

  const reportId = formData.get('report_id') as string
  const action = formData.get('action') as string
  if (!['remove', 'actioned', 'dismissed'].includes(action)) return { error: 'Unknown action.' }

  const { error } = await supabase.rpc('resolve_report', { p_report_id: reportId, p_action: action })
  if (error) return { error: error.message }

  revalidatePath('/admin')
  return { ok: true }
}

