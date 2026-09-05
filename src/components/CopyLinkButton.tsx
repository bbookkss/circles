'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import Circled from '@/components/Circled'

export default function CopyLinkButton() {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Circled>
      <Button variant="outline" size="sm" onClick={handleCopy}>
        {copied ? 'Copied' : 'Copy link'}
      </Button>
    </Circled>
  )
}
