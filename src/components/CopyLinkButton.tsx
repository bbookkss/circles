'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? '✓ Copied' : '🔗 Copy link'}
    </Button>
  )
}
