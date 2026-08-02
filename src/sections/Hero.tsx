// Hero copy is commented out for now — the section keeps its gradient shell
// so the page height and the `#hero` anchor target still work.
import { HeroScene } from './hero/HeroScene'
import { SkyDecor } from './hero/SkyDecor'
// import { motion } from 'motion/react'
// import { CursorArrow } from '@/components/CursorArrow'
// import { useT } from '@/i18n/store'

// const RISE = {
//   initial: { opacity: 0, y: 16 },
//   animate: { opacity: 1, y: 0 },
// }

export function Hero() {
  // const t = useT()

  return (
    <section
      id="hero"
      className="relative -mt-20 flex h-screen items-center overflow-hidden pt-20 pr-16 pl-[221px]"
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

      {/*
      <div className="relative z-10 w-full max-w-[691px]">
        <motion.div
          className="mb-6 flex w-fit flex-col items-end"
          {...RISE}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <span className="inline-flex items-center rounded-full bg-brand-orange px-4 py-2 text-sm font-medium text-white">
            {t('hero.badge')}
          </span>
          <CursorArrow color="#FD5000" size={22} style={{ marginTop: 2, marginRight: -16 }} />
        </motion.div>

        <motion.div
          className="flex flex-col gap-6 text-[72px] leading-[90px] text-ink"
          {...RISE}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.08 }}
        >
          <div className="flex h-25 items-center gap-4">
            <span className="flex h-25 w-[358px] shrink-0 items-center justify-center rounded-3xl border border-dashed border-brand-blue bg-brand-blue/5 p-6 font-bold text-brand-blue">
              {t('hero.designer')}
            </span>
            <span className="font-normal text-ink">{t('hero.with')}</span>
          </div>
          <div className="flex h-20 items-center gap-4">
            <span className="font-bold text-brand-red">{t('hero.dev')}</span>
            <span className="font-normal text-ink">{t('hero.background')}</span>
          </div>
        </motion.div>

        <motion.p
          className="mt-6 max-w-[522px] text-base leading-5 text-ink-muted"
          {...RISE}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.16 }}
        >
          {t('hero.subtitle')}
        </motion.p>
      </div>
      */}

    </section>
  )
}
