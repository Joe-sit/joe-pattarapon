<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { gsap } from 'gsap'

const canvasRef = ref(null)
let ctx

onMounted(() => {
  ctx = gsap.context(() => {
    const DUR = 2 // total animation duration
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0 })

    // Initial state
    gsap.set('#e-clip-rect', { attr: { x: 180, width: 4 } })
    gsap.set('#e-counter', { scaleX: 0, svgOrigin: '191 26' })
    gsap.set('#e-opening', { x: 60 })
    gsap.set('#e-front', { scaleX: 0, svgOrigin: '238 24.5' })

    // O petal data: final positions and rotations
    const petalData = [
      { cx: 119.717, cy: 62.9484, rot: 59.365 },
      { cx: 128.342, cy: 20.4592, rot: 59.365 },
      { cx: 101.732, cy: 41.2846, rot: 28.5804 },
      { cx: 146.851, cy: 41.4516, rot: 28.5804 },
    ]

    // O initial state: bullet hidden, petals at center with no rotation
    gsap.set('#o-bullet', { opacity: 0 })
    canvasRef.value.querySelectorAll('.o-petal').forEach((el) => {
      gsap.set(el, { attr: { cx: 124, cy: 42 }, opacity: 0 })
    })

    // Clip expansion: width 4 → 77 (x stays at 180)
    tl.to('#e-clip-rect', {
      attr: { width: 77 },
      duration: DUR, ease: 'power2.inOut'
    }, 0)

    // Upper counter: scales X to the right (overlaps with front)
    tl.to('#e-counter', {
      scaleX: 1, duration: DUR * 0.5, ease: 'power2.inOut'
    }, DUR * 0.3)

    // Front-e: expands from left, just before upper counter ends
    tl.to('#e-front', {
      scaleX: 1, duration: DUR * 0.3, ease: 'power2.inOut'
    }, DUR * 0.3 + DUR * 0.5 - DUR * 0.30)

    // Lower opening: slides in from the right (overlaps with counter)
    tl.to('#e-opening', {
      x: 0, duration: DUR * 0.6, ease: 'power2.inOut'
    }, DUR * 0.35)

    // Back e: reveal left extension (starts while lower is finishing)
    tl.to('#e-clip-rect', {
      attr: { x: 168 },
      duration: DUR * 0.3, ease: 'power2.inOut'
    }, DUR * 0.35 + DUR * 0.6 - DUR * 0.25)

    // ── O animation ──
    const BACK_E_START = DUR * 0.35 + DUR * 0.6 - DUR * 0.25

    // Bullet shoots from back-e toward O center while scaling up
    tl.set('#o-bullet', { opacity: 1 }, BACK_E_START + DUR * 0.1)
    tl.to('#o-bullet', {
      attr: { cx: 124, r: 20 },
      duration: DUR * 0.8, ease: 'power2.inOut'
    }, BACK_E_START + DUR * 0.1)

    // Petals appear while bullet is still scaling (overlap)
    const bulletEnd = BACK_E_START + DUR * 0.1 + DUR * 0.8
    const petalStart = bulletEnd - DUR * 0.2
    const petals = canvasRef.value.querySelectorAll('.o-petal')

    // Petals fade in at center (no pop)
    tl.to('.o-petal', {
      opacity: 1, duration: DUR * 0.2, ease: 'power2.inOut'
    }, petalStart)

    // Petals spread to final positions (starts while bullet still growing)
    petals.forEach((el, i) => {
      const p = petalData[i]
      tl.to(el, {
        attr: { cx: p.cx, cy: p.cy },
        duration: DUR * 0.4, ease: 'power2.inOut'
      }, petalStart + DUR * 0.05)
    })

    // Bullet fades as petals spread past it
    tl.to('#o-bullet', {
      opacity: 0, duration: DUR * 0.2, ease: 'power2.inOut'
    }, petalStart + DUR * 0.15)

    // Petals rotate into final orientation (overlaps with spread)
    petals.forEach((el, i) => {
      const p = petalData[i]
      tl.to(el, {
        rotation: p.rot,
        svgOrigin: `${p.cx} ${p.cy}`,
        duration: DUR * 0.35, ease: 'power2.inOut'
      }, petalStart + DUR * 0.25)
    })

    // Hold final frame, then fade out and reset
    tl.to('#letters-scene', { opacity: 0, duration: 0.4, ease: 'power1.in' }, '+=1')
    tl.set('#letters-scene', { opacity: 1 })
    tl.set('#e-clip-rect', { attr: { x: 180, width: 4 } })
    tl.set('#e-counter', { scaleX: 0 })
    tl.set('#e-opening', { x: 60 })
    tl.set('#e-front', { scaleX: 0 })
    tl.set('#o-bullet', { opacity: 0, attr: { cx: 168, r: 6 } })
    petals.forEach((el) => {
      tl.set(el, { attr: { cx: 124, cy: 42 }, rotation: 0, opacity: 0 })
    })

  }, canvasRef.value)
})

onUnmounted(() => {
  ctx?.revert()
})
</script>

<template>
  <div ref="canvasRef" class="letters-canvas">
    <svg
      id="letters-scene"
      viewBox="-10 -10 265 104"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="e-reveal">
          <rect data-name="back-e" id="e-clip-rect" x="180" y="0" width="4" height="84" />
        </clipPath>
      </defs>

      <!-- J -->
      <g data-name="j-letter">
        <path data-name="body-j" d="M33 0H81V43.5C81 65.8675 62.8675 84 40.5 84C18.1325 84 0 65.8675 0 43.5V30H33Z" fill="#E1E1E1" />
        <path data-name="j-mask" d="M41 55C36.5817 55 33 51.4183 33 47L33 30L49 30L49 47C49 51.4183 45.4183 55 41 55Z" fill="black" />
      </g>

      <!-- O -->
      <circle data-name="o-bullet" id="o-bullet" cx="168" cy="42" r="6" fill="#E1E1E1" />
      <g data-name="o-letter" id="o-petals">
        <ellipse class="o-petal" data-name="o-petal-1" cx="119.717" cy="62.9484" rx="15.1684" ry="18.4624" fill="#E1E1E1" />
        <ellipse class="o-petal" data-name="o-petal-2" cx="128.342" cy="20.4592" rx="15.1684" ry="18.4624" fill="#E1E1E1" />
        <ellipse class="o-petal" data-name="o-petal-3" cx="101.732" cy="41.2846" rx="14.1752" ry="19.4078" fill="#E1E1E1" />
        <ellipse class="o-petal" data-name="o-petal-4" cx="146.851" cy="41.4516" rx="14.1752" ry="19.4078" fill="#E1E1E1" />
      </g>

      <!-- E -->
      <g clip-path="url(#e-reveal)">
        <path data-name="body-e" d="M180 2H238V81H180V65H168V18H180Z" fill="#E1E1E1" />
        <rect data-name="front-e" id="e-front" x="237" y="10" width="8" height="29" fill="#E1E1E1" />

        <rect
          data-name="upper-e-mask"
          class="e-cutout" id="e-counter"
          x="191" y="18" width="35" height="16" rx="8"
          fill="black"
        />
        <path
          data-name="lower-e-mask"
          class="e-cutout" id="e-opening"
          d="M191 57C191 52.5817 194.582 49 199 49H245V65H199C194.582 65 191 61.4183 191 57Z"
          fill="black"
        />
      </g>

      <!-- Debug labels -->
      <text x="40" y="-2" fill="#666" font-size="5" font-family="monospace" text-anchor="middle">J</text>
      <text x="124" y="-2" fill="#666" font-size="5" font-family="monospace" text-anchor="middle">O</text>
      <text x="168" y="38" fill="#666" font-size="4" font-family="monospace">o-bullet</text>
      <text x="119" y="72" fill="#666" font-size="3" font-family="monospace" text-anchor="middle">petal-1</text>
      <text x="128" y="14" fill="#666" font-size="3" font-family="monospace" text-anchor="middle">petal-2</text>
      <text x="88" y="42" fill="#666" font-size="3" font-family="monospace" text-anchor="middle">petal-3</text>
      <text x="160" y="42" fill="#666" font-size="3" font-family="monospace" text-anchor="middle">petal-4</text>
      <text x="200" y="-2" fill="#666" font-size="5" font-family="monospace">body-e</text>
      <text x="243" y="8" fill="#666" font-size="4" font-family="monospace">front-e</text>
      <text x="195" y="16" fill="#666" font-size="4" font-family="monospace">upper-e-mask</text>
      <text x="195" y="48" fill="#666" font-size="4" font-family="monospace">lower-e-mask</text>
      <text x="164" y="42" fill="#666" font-size="4" font-family="monospace" text-anchor="end">back-e</text>
    </svg>
  </div>
</template>

<style scoped>
.letters-canvas {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

#letters-scene {
  width: 70%;
  max-width: 700px;
}
</style>
