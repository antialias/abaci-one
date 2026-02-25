'use client'

import dynamic from 'next/dynamic'

const TenFramesHero = dynamic(() => import('@/components/blog/heroes/TenFramesHero'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        height: 300,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#4b5563',
        fontSize: 14,
      }}
    >
      Loading…
    </div>
  ),
})

export function TenFramesInline() {
  return (
    <figure style={{ margin: '2.5rem 0' }}>
      <TenFramesHero />
      <figcaption
        style={{
          marginTop: '0.75rem',
          color: '#6b7280',
          fontSize: 13,
          fontStyle: 'italic',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        27 + 14 at three scaffolding levels. The plain format hides the structure; the ten-frame
        makes it visible and touchable. The arithmetic is identical — what changes is how much of
        the reasoning the student has to hold in their head.
      </figcaption>
    </figure>
  )
}
