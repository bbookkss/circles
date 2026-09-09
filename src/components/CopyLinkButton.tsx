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

  // No <Circled> here on purpose. The sketched oval is for borderless text
  // links (TopNav, Back, Edit); drawn over a bordered Button it reads as two
  // competing outlines. This sits next to Leave, so it should match it.
  return (
    <Button variant="outline" size="sm" onClick={handleCopy}>
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  )
}
