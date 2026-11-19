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
      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-2xl mx-auto space-y-3">
          {messages.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">
              No messages yet. Say hi to {otherName}.
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === meId
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] px-4 py-2.5 text-[0.95rem] ${mine ? 'bg-foreground text-background rounded-[20px_20px_6px_20px]' : 'bg-muted text-foreground rounded-[20px_20px_20px_6px]'}`}>
                    <p className="whitespace-pre-wrap break-words">{m.content}</p>
                    <p className={`num text-xs mt-1 ${mine ? 'text-background/65' : 'text-muted-foreground'}`}>{formatTime(m.created_at)}</p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="px-3 md:px-6 pt-2 pb-3">
        <div className="max-w-2xl mx-auto">
          {canMessage ? (
            <form onSubmit={onSend} className="glass flex items-center gap-2 rounded-full p-1.5 pl-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message ${otherName}`}
                maxLength={2000}
                className="flex-1 min-w-0 bg-transparent px-3 py-2 text-base placeholder:text-muted-foreground focus-visible:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !text.trim()}
                className="text-sm font-medium rounded-full bg-foreground text-background px-5 py-2.5 hover:opacity-85 disabled:opacity-35 transition-opacity"
              >
                Send
              </button>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-3">
              Follow {otherName} to send a message.
            </p>
          )}
          {error && <p className="text-sm text-destructive mt-2 text-center">{error}</p>}
        </div>
      </div>
    </div>
  )
}
