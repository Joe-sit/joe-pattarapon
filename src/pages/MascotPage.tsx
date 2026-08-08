import { MascotScene } from '@/sections/mascot/MascotScene'
import { usePalette } from '@/stores/theme'

/**
 * The mascot on his own, in 3D.
 *
 * Same sky the hero stands under, so he is lit by a scene the rest of the site
 * already agrees on rather than floating on a swatch.
 */
export function MascotPage() {
  const sky = usePalette().scene.sky

  return (
    <div
      className="relative -mt-20 flex h-screen w-full items-center justify-center pt-20"
      style={{
        background: `linear-gradient(180deg, ${sky[0]} 0%, ${sky[2]} 38%, ${sky[4]} 74%, ${sky[5]} 100%)`,
      }}
    >
      <div className="absolute inset-0">
        <MascotScene />
      </div>
    </div>
  )
}
