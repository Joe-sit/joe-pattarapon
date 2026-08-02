import { useEffect, useState } from 'react'
import { motion } from 'motion/react'
import { useT } from '@/i18n/store'

/**
 * The nudge at the foot of the hero, once the story on the platform has played
 * out and the page has nothing left to say for itself.
 *
 * It retires the moment the page moves: an invitation that stays on screen
 * after it has been taken reads as decoration.
 */
export function ScrollCue() {
  const t = useT()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 bottom-10 z-10 flex flex-col items-center gap-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: scrolled ? 0 : 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      {/* On its own pill: the cue sits over the platform, whose colour is the
          one thing in the scene that changes most between themes. */}
      <span className="rounded-full bg-panel/75 px-4 py-1.5 text-xs font-medium tracking-[0.14em] text-ink-muted uppercase backdrop-blur">
        {t('hero.scroll')}
      </span>

      {/* A mouse, with the wheel travelling down it. */}
      <span className="flex h-8 w-5 justify-center rounded-full border border-ink-muted/60 bg-panel/60 pt-1.5 backdrop-blur">
        <motion.span
          className="size-1 rounded-full bg-ink-muted"
          animate={{ y: [0, 9, 0], opacity: [1, 1, 0.2] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </span>
    </motion.div>
  )
}
