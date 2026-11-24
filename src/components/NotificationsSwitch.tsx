'use client'

import { useEffect, useState } from 'react'
import { removePushSubscription, savePushSubscription, sendTestPush } from '@/app/actions/push'

/**
 * Notifications for this device: on, off, and a test.
 *
 * iPhone only allows them in the app opened from the home screen, and only
 * after a tap on something like this button (iOS then shows its own Allow
 * prompt). So the states are spelled out rather than leaving a dead button.
 *
 * `prompt` is the Home-screen variant: shown only in the installed app, only
 * while undecided, and gone for good once dismissed.
 */

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const DISMISS = 'circles-push-prompt'

type State =
  | 'loading'
  | 'unsupported'
  | 'install-first'
  | 'denied'
  | 'off'
  | 'on'

export const WHAT_IS_SENT =
  "When check-in opens for a meet you haven't answered, 3 hours before a meet you're going to, and when someone messages you."

function keyBytes(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIOS() {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

export default function NotificationsSwitch({ prompt = false }: { prompt?: boolean }) {
  const [state, setState] = useState<State>('loading')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let live = true
    ;(async () => {
      let next: State
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        next = isIOS() && !isStandalone() ? 'install-first' : 'unsupported'
      } else if (Notification.permission === 'denied') {
        next = 'denied'
      } else {
        const reg = await navigator.serviceWorker.getRegistration('/')
        const sub = await reg?.pushManager.getSubscription()
        next = sub && Notification.permission === 'granted' ? 'on' : 'off'
      }
      let dismissed = false
      try { dismissed = localStorage.getItem(DISMISS) === '1' } catch {}
      if (live) {
        setState(next)
        setHidden(prompt && (dismissed || !isStandalone()))
      }
    })().catch(() => live && setState('unsupported'))
    return () => { live = false }
  }, [prompt])

  if (!KEY) return null

  async function turnOn() {
    setBusy(true)
    setNote(null)
    try {
      // Ask first, straight from the tap: Safari only shows its prompt while
      // the tap still counts, and awaiting anything before it can lose that.
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await navigator.serviceWorker.ready
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY!) }))
      const res = await savePushSubscription(JSON.parse(JSON.stringify(sub)))
      if ('error' in res && res.error) {
        await sub.unsubscribe().catch(() => {})
        setNote(res.error)
        return
      }
      setState('on')
      if (prompt) setHidden(true)
    } catch {
      setNote("Couldn't turn on notifications. Try again.")
    } finally {
      setBusy(false)
    }
  }

  async function turnOff() {
    setBusy(true)
    setNote(null)
    try {
      const reg = await navigator.serviceWorker.getRegistration('/')
      const sub = await reg?.pushManager.getSubscription()
      if (sub) {
        await removePushSubscription(sub.endpoint)
        await sub.unsubscribe()
      }
      setState('off')
    } finally {
      setBusy(false)
    }
  }

  async function test() {
    setBusy(true)
    const res = await sendTestPush()
    setNote('error' in res && res.error ? res.error : 'Sent. It should arrive in a few seconds.')
    setBusy(false)
  }

  function dismiss() {
    setHidden(true)
    try { localStorage.setItem(DISMISS, '1') } catch {}
  }

  if (prompt) {
    if (hidden || state !== 'off') return null
    return (
      <div className="rounded-2xl bg-muted px-4 py-3.5 text-sm">
        <p className="font-medium">Get notified?</p>
        <p className="text-muted-foreground mt-1 leading-snug">{WHAT_IS_SENT}</p>
        <div className="flex gap-2 mt-3">
          <button type="button" disabled={busy} onClick={turnOn} className="h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium disabled:opacity-50">
            Turn on
          </button>
          <button type="button" onClick={dismiss} className="h-9 px-3 rounded-full text-[13px] text-muted-foreground hover:text-foreground">
            Not now
          </button>
        </div>
        {note && <p className="text-xs text-muted-foreground mt-2">{note}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">{WHAT_IS_SENT}</p>
      {state === 'loading' && <p className="text-muted-foreground">Checking this device…</p>}
      {state === 'install-first' && (
        <p>On iPhone, add Circles to your Home Screen first: in Safari tap Share, then Add to Home Screen. Open it from there and turn notifications on here.</p>
      )}
      {state === 'unsupported' && <p>This browser can&apos;t show notifications.</p>}
      {state === 'denied' && (
        <p>Notifications are blocked for Circles. Turn them on in Settings, Notifications, Circles (or this browser&apos;s site settings), then come back here.</p>
      )}
      {state === 'off' && (
        <button type="button" disabled={busy} onClick={turnOn} className="h-9 px-4 rounded-full bg-foreground text-background text-[13px] font-medium disabled:opacity-50">
          Turn on notifications
        </button>
      )}
      {state === 'on' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 mr-1"><span className="w-1.5 h-1.5 rounded-full bg-heat" aria-hidden />On for this device</span>
          <button type="button" disabled={busy} onClick={test} className="h-8 px-3.5 rounded-full bg-muted text-[13px] font-medium hover:bg-cool-2 disabled:opacity-50">
            Send a test
          </button>
          <button type="button" disabled={busy} onClick={turnOff} className="h-8 px-3 rounded-full text-[13px] text-muted-foreground hover:text-foreground disabled:opacity-50">
            Turn off
          </button>
        </div>
      )}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  )
}
