'use client'

import { useState } from 'react'
import { followUser, unfollowUser } from '@/app/actions/follows'

type Props = {
  targetId: string
  circleId: string
  initialIsFollowing: boolean
}

export default function FollowButton({ targetId, circleId, initialIsFollowing }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    const formData = new FormData()
    formData.set('following_id', targetId)
    formData.set('circle_id', circleId)

    if (isFollowing) {
      setIsFollowing(false)
      await unfollowUser(formData)
    } else {
      setIsFollowing(true)
      await followUser(formData)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
        isFollowing
          ? 'bg-foreground text-background border-foreground hover:bg-foreground/80'
          : 'border-input hover:bg-muted'
      }`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
