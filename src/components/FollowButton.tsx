'use client'

import { useState } from 'react'
import { followUser, unfollowUser } from '@/app/actions/follows'

type Props = {
  targetId: string
  /** Only for revalidating a circle page the button sits on. Optional elsewhere. */
  circleId?: string
  initialIsFollowing: boolean
}

export default function FollowButton({ targetId, circleId, initialIsFollowing }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing)
  const [loading, setLoading] = useState(false)

  async function handleToggle() {
    setLoading(true)
    const formData = new FormData()
    formData.set('following_id', targetId)
    if (circleId) formData.set('circle_id', circleId)

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
      className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors disabled:opacity-60 ${
        isFollowing
          ? 'bg-muted text-foreground hover:bg-cool-2'
          : 'bg-foreground text-background hover:opacity-85'
      }`}
    >
      {isFollowing ? 'Following' : 'Follow'}
    </button>
  )
}
