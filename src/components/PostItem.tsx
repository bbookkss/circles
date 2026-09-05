'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toggleLike, toggleCommentLike, addComment, deleteComment, deletePost } from '@/app/actions/posts'

type Comment = {
  id: string
  user_id: string
  author_name: string
  content: string
  created_at: string
  likeCount: number
  likedByMe: boolean
}

type Props = {
  post: {
    id: string
    circleId: string
    content: string
    created_at: string
    user_id: string
    author_name: string
  }
  currentUserId: string
  currentUserName: string
  initialLikeCount: number
  initialLiked: boolean
  initialComments: Comment[]
  canInteract: boolean
}

function initialsOf(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

function Avatar({ name, size = 'sm' }: { name: string; size?: 'sm' | 'xs' }) {
  return (
    <div className={`rounded-full bg-muted flex items-center justify-center font-semibold flex-shrink-0 ${size === 'xs' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-xs'}`}>
      {initialsOf(name)}
    </div>
  )
}

export default function PostItem({
  post,
  currentUserId,
  currentUserName,
  initialLikeCount,
  initialLiked,
  initialComments,
  canInteract,
}: Props) {
  const [liked, setLiked] = useState(initialLiked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [posting, setPosting] = useState(false)

  async function onLike() {
    if (!canInteract) return
    const next = !liked
    setLiked(next)
    setLikeCount((c) => c + (next ? 1 : -1))
    const res = await toggleLike(post.id, post.circleId, next)
    if (res?.error) {
      // revert on failure
      setLiked(!next)
      setLikeCount((c) => c + (next ? -1 : 1))
    }
  }

  async function onAddComment(e: React.FormEvent) {
    e.preventDefault()
    const text = commentText.trim()
    if (!text || posting) return
    setPosting(true)
    const fd = new FormData()
    fd.set('post_id', post.id)
    fd.set('circle_id', post.circleId)
    fd.set('content', text)
    const res = await addComment(fd)
    setPosting(false)
    if (!res?.error) {
      setComments((cs) => [
        ...cs,
        { id: `temp-${Date.now()}`, user_id: currentUserId, author_name: currentUserName, content: text, created_at: new Date().toISOString(), likeCount: 0, likedByMe: false },
      ])
      setCommentText('')
      setShowComments(true)
    }
  }

  async function onDeleteComment(id: string) {
    setComments((cs) => cs.filter((c) => c.id !== id))
    const fd = new FormData()
    fd.set('comment_id', id)
    fd.set('circle_id', post.circleId)
    await deleteComment(fd)
  }

  async function onLikeComment(id: string) {
    if (!canInteract) return
    const target = comments.find((c) => c.id === id)
    if (!target) return
    const next = !target.likedByMe
    setComments((cs) => cs.map((c) => (c.id === id ? { ...c, likedByMe: next, likeCount: c.likeCount + (next ? 1 : -1) } : c)))
    const res = await toggleCommentLike(id, post.circleId, next)
    if (res?.error) {
      setComments((cs) => cs.map((c) => (c.id === id ? { ...c, likedByMe: !next, likeCount: c.likeCount + (next ? -1 : 1) } : c)))
    }
  }

  const isMyPost = post.user_id === currentUserId

  return (
    <article className="py-5">
      <div className="flex gap-3">
        <Avatar name={post.author_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-1">
            <Link
              href={isMyPost ? '/profile' : `/profile/${post.user_id}`}
              className="text-sm font-medium hover:underline underline-offset-2"
            >
              {post.author_name}
            </Link>
            <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">{post.content}</p>

          {/* Actions */}
          <div className="flex items-center gap-5 mt-2.5 text-xs">
            <button
              type="button"
              onClick={onLike}
              disabled={!canInteract}
              className={`${liked ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'} ${!canInteract ? 'cursor-default' : ''} transition-colors`}
            >
              {liked ? 'Liked' : 'Like'}{likeCount > 0 ? ` (${likeCount})` : ''}
            </button>
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Comment'}
            </button>
            {isMyPost && (
              <form action={deletePost} className="ml-auto">
                <input type="hidden" name="post_id" value={post.id} />
                <input type="hidden" name="circle_id" value={post.circleId} />
                <button type="submit" className="text-muted-foreground hover:text-destructive transition-colors">delete</button>
              </form>
            )}
          </div>

          {/* Comments */}
          {showComments && (
            <div className="mt-4 space-y-3.5 fade-in">
              {comments.map((c) => {
                const mine = c.user_id === currentUserId
                return (
                  <div key={c.id} className="flex gap-2">
                    <Avatar name={c.author_name} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <Link
                          href={mine ? '/profile' : `/profile/${c.user_id}`}
                          className="text-xs font-medium hover:underline underline-offset-2"
                        >
                          {c.author_name}
                        </Link>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                        {mine && (
                          <button
                            type="button"
                            onClick={() => onDeleteComment(c.id)}
                            className="text-[10px] text-muted-foreground hover:text-destructive ml-auto"
                          >
                            delete
                          </button>
                        )}
                      </div>
                      <p className="text-xs whitespace-pre-wrap break-words">{c.content}</p>
                      {!c.id.startsWith('temp-') && (
                        <button
                          type="button"
                          onClick={() => onLikeComment(c.id)}
                          disabled={!canInteract}
                          className={`mt-1 text-[10px] ${c.likedByMe ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'} ${!canInteract ? 'cursor-default' : ''} transition-colors`}
                        >
                          {c.likedByMe ? 'Liked' : 'Like'}{c.likeCount > 0 ? ` (${c.likeCount})` : ''}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}

              {canInteract && (
                <form onSubmit={onAddComment} className="flex items-center gap-2 pt-1">
                  <Avatar name={currentUserName} size="xs" />
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add a comment..."
                    maxLength={500}
                    className="flex-1 min-w-0 rounded-full border border-input bg-background px-3.5 py-1.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-shadow"
                  />
                  <button
                    type="submit"
                    disabled={posting || !commentText.trim()}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors px-1"
                  >
                    post
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
