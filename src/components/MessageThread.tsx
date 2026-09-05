'use client'

import { useEffect, useRef, useState } from 'react'
import { sendMessage, markConversationRead } from '@/app/actions/messages'

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
}

type Props = {
  meId: string
  otherUserId: string
  otherName: string
  initialMessages: Message[]
  canMessage: boolean
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function MessageThread({ meId, otherUserId, otherName, initialMessages, canMessage }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Mark the conversation read on mount
  useEffect(() => {
    markConversationRead(otherUserId)
  }, [otherUserId])

  // Keep scrolled to the latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function onSend(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    const res = await sendMessage(otherUserId, body)
    setSending(false)
    if (res?.error) {
      setError(res.error)
      return
    }
    setMessages((m) => [...m, { id: `temp-${Date.now()}`, sender_id: meId, content: body, created_at: new Date().toISOString() }])
    setText('')
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No messages yet. Say hi to {otherName}.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === meId
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${mine ? 'bg-foreground text-background' : 'bg-muted text-foreground'}`}>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`text-[10px] mt-1 ${mine ? 'text-background/60' : 'text-muted-foreground'}`}>{formatTime(m.created_at)}</p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t bg-background px-6 py-3">
        <div className="max-w-2xl mx-auto">
          {canMessage ? (
            <form onSubmit={onSend} className="flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message ${otherName}...`}
                maxLength={2000}
                className="flex-1 min-w-0 rounded-full border border-input bg-background px-4 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors px-2"
              >
                send
              </button>
            </form>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              You can only message people who follow you back.
            </p>
          )}
          {error && <p className="text-xs text-destructive mt-1 text-center">{error}</p>}
        </div>
      </div>
    </div>
  )
}
