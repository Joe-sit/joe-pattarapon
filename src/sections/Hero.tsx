import { motion } from 'motion/react'
import { HeroScene } from './hero/HeroScene'
import { SkyDecor } from './hero/SkyDecor'
import { usePuzzleDone } from '@/stores/heroStory'
import { useT } from '@/i18n/store'

const RISE = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
}

export function Hero() {
  const t = useT()
  // The sentence only lands once the orbs have finished bringing the puzzle in.
  const puzzleDone = usePuzzleDone()

  return (
    <section
      id="hero"
      className="relative -mt-20 flex h-screen items-start justify-center overflow-hidden px-16 pt-20"
      style={{
        // Sky over ground. A 3D sky dome can't work here: the scene camera is a
        // 15° lens pitched 20° down, so the true horizon sits above the frame.
        // Splitting the backdrop in screen space puts sky on top regardless.
        background:
          'linear-gradient(180deg, #7FC0F2 0%, #A9D6F7 14%, #DCEEFF 30%, #F6FBFF 40%, #F7F3FB 62%, #F3EFFA 100%)',
      }}
    >
      {/* Sky first, scene after: the platform has to paint over the sky band. */}
      <SkyDecor />

      {/* The 3D scene: platform, unrolling blueprint, assembling jigsaw. */}
      <div className="absolute inset-0">
        <HeroScene />
      </div>

      {/* The copy lives in the sky band: the platform's far edge cuts across at
          roughly a third of the viewport, and the run above it is the only clear
          ground the sentence has. */}
      {puzzleDone && (
        <div className="relative z-10 mt-6 flex w-full max-w-[880px] flex-col items-center text-center">
          <motion.div
            className="flex flex-col items-center gap-3 text-[48px] leading-[1.15] text-ink"
            {...RISE}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="flex items-center gap-4">
              <span className="font-medium">{t('hero.turning')}</span>
              <span className="rounded-2xl border border-dashed border-brand-blue bg-brand-blue/5 px-5 py-2 font-bold text-brand-blue">
                {t('hero.vision')}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-normal">{t('hero.into')}</span>
              <span className="font-bold text-brand-red">{t('hero.experiences')}</span>
            </div>
          </motion.div>

          <motion.p
            className="mt-5 max-w-[522px] text-base leading-5 text-balance text-ink-muted"
            {...RISE}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.08 }}
          >
            {t('hero.subtitle')}
          </motion.p>
        </div>
      )}
    </section>
  )
}
