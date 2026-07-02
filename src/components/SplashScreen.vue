<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { gsap } from 'gsap'

const emit = defineEmits(['done'])
const sceneRef = ref(null)
let ctx

const petalData = [
  { cx: 117.717, cy: 62.9484, rot: 59.365 },
  { cx: 126.342, cy: 20.4592, rot: 59.365 },
  { cx: 99.732,  cy: 41.2846, rot: 28.5804 },
  { cx: 144.851, cy: 41.4516, rot: 28.5804 },
]

onMounted(() => {
  if (!sceneRef.value) return
  ctx = gsap.context(() => {
    const petals = sceneRef.value.querySelectorAll('.o-petal')

    // Initial state
    gsap.set('#sp-e-clip-rect',  { attr: { x: 174, width: 4 } })
    gsap.set('#sp-e-counter',    { scaleX: 0, svgOrigin: '185 26' })
    gsap.set('#sp-e-opening',    { x: 60 })
    gsap.set('#sp-e-front',      { scaleX: 0, svgOrigin: '232 24.5' })
    gsap.set('#sp-o-bullet',     { opacity: 0, attr: { cx: 173, r: 1 } })
    petals.forEach(el => gsap.set(el, { attr: { cx: 122, cy: 42 }, rotation: 0, opacity: 0 }))
    gsap.set('#sp-j-body',   { y: -100 })
    gsap.set('#sp-j-mask',   { scale: 0, svgOrigin: '34 31' })
    gsap.set('#sp-j-corner', { scale: 0, svgOrigin: '0 0' })
    gsap.set('#sp-slide-group', { x: -80 })

    const tl = gsap.timeline({
      onComplete: () => {
        // Fade out the splash wrapper, then notify parent
        gsap.to('.splash-wrapper', {
          opacity: 0, duration: 0.5, ease: 'power1.inOut',
          onComplete: () => emit('done'),
        })
      },
    })

    // Slide
    tl.to('#sp-slide-group', { x: -60, duration: 1.18, ease: 'power1.in' }, 0)
    tl.to('#sp-slide-group', { x: 0,   duration: 2.06, ease: 'power1.5.out' }, 1.17)

    // E
    tl.to('#sp-e-clip-rect', { attr: { width: 77 }, duration: 1.32, ease: 'power2.inOut' }, 0)
    tl.to('#sp-e-counter',   { scaleX: 1, duration: 0.66, ease: 'power2.inOut' }, 0.4)
    tl.to('#sp-e-front',     { scaleX: 1, duration: 0.4,  ease: 'power2.inOut' }, 0.66)
    tl.to('#sp-e-opening',   { x: 0,      duration: 0.8,  ease: 'power2.inOut' }, 0.46)
    tl.to('#sp-e-clip-rect', { attr: { x: 162 }, duration: 0.39, ease: 'power2.inOut' }, 0.93)

    // O bullet
    tl.set('#sp-o-bullet', { opacity: 1 }, 1.12)
    tl.to('#sp-o-bullet',  { attr: { cx: 122, r: 20 }, duration: 0.51, ease: 'power2.out' }, 1.12)
    tl.to('.sp-o-petal',   { opacity: 1, duration: 0.15, ease: 'power2.inOut' }, 1.42)
    petals.forEach((el, i) => {
      const p = petalData[i]
      tl.to(el, { attr: { cx: p.cx, cy: p.cy }, duration: 0.72, ease: 'power2.inOut' }, 1.32)
    })
    tl.to('#sp-o-bullet', { opacity: 0, duration: 0.2, ease: 'power2.inOut' }, 1.57)
    petals.forEach((el, i) => {
      const p = petalData[i]
      tl.to(el, { rotation: p.rot, svgOrigin: `${p.cx} ${p.cy}`, duration: 1.4, ease: 'power2.inOut' }, 1.42)
    })

    // J
    tl.to('#sp-j-body',   { y: 0,     duration: 1.74, ease: 'power2.inOut' }, 0.87)
    tl.to('#sp-j-corner', { scale: 1, duration: 1.45, ease: 'power2.inOut' }, 1.43)
    tl.to('#sp-j-mask',   { scale: 1, duration: 1.4,  ease: 'power2.inOut' }, 1.6)

    // Hold then fade out scene
    tl.to('#sp-letters-scene', { opacity: 0, duration: 0.4, ease: 'power1.in' }, 3)
  }, sceneRef.value)
})

onUnmounted(() => ctx?.revert())
</script>

<template>
  <div class="splash-wrapper" ref="sceneRef">
    <svg
      id="sp-letters-scene"
      viewBox="-10 -10 259 104"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="sp-e-reveal">
          <rect id="sp-e-clip-rect" x="174" y="0" width="4" height="84" />
        </clipPath>
      </defs>

      <g id="sp-slide-group">
        <!-- J -->
        <g>
          <path id="sp-j-body"
            d="M0 0H81V43.5C81 65.8675 62.8675 84 40.5 84V84C18.1325 84 0 65.8675 0 43.5V0Z"
            fill="#FD5000"
          />
          <path id="sp-j-mask"
            d="M41 55C36.5817 55 33 51.4183 33 47L33 30L49 30L49 47C49 51.4183 45.4183 55 41 55V55Z"
            fill="#F1F0EE"
          />
          <rect id="sp-j-corner" x="-1" y="-1" width="35" height="32" fill="#F1F0EE" />
        </g>

        <!-- O -->
        <g id="sp-o-petals">
          <ellipse class="sp-o-petal o-petal" cx="117.717" cy="62.9484" rx="15.1684" ry="18.4624" fill="#FD5000" />
          <ellipse class="sp-o-petal o-petal" cx="126.342" cy="20.4592" rx="15.1684" ry="18.4624" fill="#FD5000" />
          <ellipse class="sp-o-petal o-petal" cx="99.732"  cy="41.2846" rx="14.1752" ry="19.4078" fill="#FD5000" />
          <ellipse class="sp-o-petal o-petal" cx="144.851" cy="41.4516" rx="14.1752" ry="19.4078" fill="#FD5000" />
        </g>
        <circle id="sp-o-bullet" cx="173" cy="42" r="1" fill="#FD5000" />

        <!-- E -->
        <g clip-path="url(#sp-e-reveal)">
          <path d="M174 2H232V81H174V65H162V18H174Z" fill="#FD5000" />
          <rect id="sp-e-front" x="231" y="10" width="8" height="29" fill="#FD5000" />
          <rect id="sp-e-counter" x="185" y="18" width="35" height="16" rx="8" fill="#F1F0EE" />
          <path id="sp-e-opening"
            d="M185 57C185 52.5817 188.582 49 193 49H239V65H193C188.582 65 185 61.4183 185 57Z"
            fill="#F1F0EE"
          />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.splash-wrapper {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: #F1F0EE;
  display: flex;
  align-items: center;
  justify-content: center;
}

#sp-letters-scene {
  width: clamp(200px, 40vw, 480px);
  height: auto;
  overflow: hidden;
}
</style>
