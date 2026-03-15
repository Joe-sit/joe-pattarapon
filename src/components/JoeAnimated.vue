<script setup>
import { onMounted } from 'vue'
import { gsap } from 'gsap'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'

gsap.registerPlugin(MorphSVGPlugin)

// ─── STARTING shapes (abstract geometric) ────────────────────────────────────

// J — full circle collapses into J arc; stem starts as filled square
const J_ARC_START  = 'M62,0 C96.25,0 124,27.75 124,62 C124,96.25 96.25,124 62,124 C27.75,124 0,96.25 0,62 C0,27.75 27.75,0 62,0 Z'
const J_STEM_START = 'M62,0 L124,0 L124,62 L62,62 Z'

// O — full circle split into 4 quarter pie-slices matching the 4 final wedge subpaths
const O_CIRCLE_START = [
  'M210,0 A62,62,0,0,0,148,62 L210,62 Z',    // TL quarter
  'M210,0 A62,62,0,0,1,272,62 L210,62 Z',    // TR quarter
  'M148,62 A62,62,0,0,0,210,124 L210,62 Z',  // BL quarter
  'M272,62 A62,62,0,0,1,210,124 L210,62 Z',  // BR quarter
].join(' ')

// E — five equal-height bars, evenly distributed
const E_START = [
  'M420,0   H296 V24.8 H420 Z',
  'M420,24.8 H296 V49.6 H420 Z',
  'M420,49.6 H296 V74.4 H420 Z',
  'M420,74.4 H296 V99.2 H420 Z',
  'M420,99.2 H296 V124  H420 Z',
]

// ─── FINAL design paths (from JOE.svg) ───────────────────────────────────────

const J_ARC_FINAL  = 'M124 62C124 70.142 122.396 78.2042 119.281 85.7264C116.165 93.2486 111.598 100.083 105.841 105.841C100.083 111.598 93.2486 116.165 85.7264 119.281C78.2042 122.396 70.142 124 62 124C53.858 124 45.7958 122.396 38.2736 119.281C30.7514 116.165 23.9166 111.598 18.1594 105.841C12.4021 100.083 7.83526 93.2486 4.71947 85.7264C1.60368 78.2042 -7.11792e-07 70.142 0 62L62 62H124Z'
const J_STEM_FINAL = 'M64.6387 42C64.6387 18.804 83.4427 0 106.639 0H124V62H64.6387V42Z'

// Combined O final shape: 4 subpaths (TL, TR, BL, BR) matching star arm order
const O_FINAL = [
  'M210.004 0C201.862 0 193.8 1.59882 186.278 4.71351C178.755 7.8282 171.92 12.3949 166.162 18.1528C160.404 23.9106 155.836 30.7468 152.72 38.2708C149.605 45.7926 148.001 53.8546 148 62C156.141 62 164.202 60.3962 171.723 57.2817C179.245 54.1671 186.08 49.601 191.837 43.8441C197.595 38.0872 202.162 31.2522 205.279 23.7294C208.396 16.2066 210.002 8.14339 210.004 0Z',
  'M210.004 0C210.005 8.14339 211.609 16.2068 214.725 23.73C217.841 31.2531 222.408 38.0886 228.165 43.8462C233.922 49.6038 240.756 54.1707 248.277 57.2861C255.798 60.4016 263.859 62.0046 272 62C271.999 53.8615 270.394 45.7957 267.279 38.2736C264.162 30.7505 259.596 23.915 253.839 18.1574C248.082 12.3999 241.248 7.83298 233.726 4.71752C226.205 1.60207 218.144 0 210.004 0Z',
  'M210.004 124C210.003 115.856 208.398 107.792 205.281 100.268C202.165 92.7447 197.597 85.9089 191.84 80.1513C186.082 74.3936 179.247 69.8269 171.725 66.7118C164.203 63.5968 156.141 61.9945 148 62C148.001 70.1398 149.606 78.205 152.722 85.728C155.839 93.2516 160.406 100.087 166.164 105.845C171.922 111.603 178.757 116.17 186.279 119.285C193.801 122.4 201.862 124.002 210.004 124Z',
  'M267.279 85.7264C270.394 78.2055 271.998 70.1446 272 62C255.561 62 239.794 68.5322 228.167 80.1585C216.541 91.7849 210.007 107.555 210.004 124C218.144 124 226.205 122.398 233.726 119.282C241.248 116.167 248.082 111.6 253.839 105.843C259.596 100.085 264.162 93.2495 267.279 85.7264Z',
].join(' ')

const E_FINAL = [
  'M420 0H296V2H420V0Z',
  'M420 6H296V10H420V6Z',
  'M420 14H296V20H420V14Z',
  'M420 24H296V32H420V24Z',
  'M420 36H296V124H420V36Z',
]

const SLIDE = 140

onMounted(() => {
  const tl = gsap.timeline({ repeat: -1, repeatDelay: 1 })

  // ─── Set initial shapes ───────────────────────────────────────────────────
  gsap.set('#j-arc-p',  { attr: { d: J_ARC_START  } })
  gsap.set('#j-stem-p', { attr: { d: J_STEM_START } })
  gsap.set('#o-path', { attr: { d: O_CIRCLE_START } })
  document.querySelectorAll('.e-bar').forEach((el, i) => {
    gsap.set(el, { attr: { d: E_START[i] } })
  })

  // Each letter starts hidden off-screen in its own direction
  gsap.set('#j-group', { x: 124, y: -124 }) // top-right corner, just at clip-j boundary
  gsap.set('#o-group', { x: 0,      y: -SLIDE }) // top
  gsap.set('#e-group', { x: 0,      y: SLIDE  }) // bottom

  // Scene starts offset right, drifts left throughout
  gsap.set('#joe-scene', { x: 30 })

  // ─── Scene drift ──────────────────────────────────────────────────────────
  tl.to('#joe-scene', { x: -30, duration: 5.0, ease: 'power2.inOut' }, 0)

  // ─── Slide-ins ────────────────────────────────────────────────────────────
  tl.to('#j-group', { x: 0, y: 0, duration: 1.6, ease: 'power3.inOut' }, 0) // ↙ top-right
  tl.to('#o-group', { y: 0, duration: 1.4, ease: 'power3.inOut' }, 0.4)   // ↓ top
  tl.to('#e-group', { y: 0, duration: 1.4, ease: 'power3.inOut' }, 0.8)   // ↑ bottom

  // ─── J morphs ─────────────────────────────────────────────────────────────
  tl.to('#j-stem-p', {
    morphSVG: { shape: J_STEM_FINAL, map: 'complexity' },
    duration: 1.6, ease: 'sine.inOut',
  }, 1.5)
  tl.to('#j-arc-p', {
    morphSVG: { shape: J_ARC_FINAL, map: 'complexity' },
    duration: 1.8, ease: 'sine.inOut',
  }, 1.6)

  // ─── O: star spins and morphs into design wedges ─────────────────────────
  tl.to('#o-group', { rotation: 360, svgOrigin: '210 62', duration: 2.0, ease: 'power2.inOut' }, 1.9)
  tl.to('#o-path',  { morphSVG: { shape: O_FINAL, map: 'complexity' }, duration: 2.0, ease: 'sine.inOut' }, 1.9)

  // ─── E morphs ─────────────────────────────────────────────────────────────
  document.querySelectorAll('.e-bar').forEach((el, i) => {
    tl.to(el, {
      morphSVG: { shape: E_FINAL[i], map: 'complexity' },
      duration: 1.4, ease: 'sine.inOut',
    }, 2.2 + i * 0.15)
  })
})
</script>

<template>
  <div class="joe-canvas">
    <svg
      id="joe-scene"
      viewBox="0 0 420 124"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="clip-j"><rect x="0"   y="0" width="124" height="124"/></clipPath>
        <clipPath id="clip-o"><rect x="148" y="0" width="124" height="124"/></clipPath>
        <clipPath id="clip-e"><rect x="296" y="0" width="124" height="124"/></clipPath>
      </defs>

      <!-- J: hook (arc) + stem — starts as readable bold J -->
      <g clip-path="url(#clip-j)">
        <g id="j-group">
          <path id="j-arc-p"  fill="#313135"/>
          <path id="j-stem-p" fill="#313135"/>
        </g>
      </g>

      <!-- O: 4-pointed star spins and morphs into design wedges -->
      <g clip-path="url(#clip-o)">
        <g id="o-group">
          <path id="o-path" fill="#313135"/>
        </g>
      </g>

      <!-- E: 5 equal bars — starts as readable E, morphs to abstract thickening -->
      <g clip-path="url(#clip-e)">
        <g id="e-group">
          <path class="e-bar" fill="#313135"/>
          <path class="e-bar" fill="#313135"/>
          <path class="e-bar" fill="#313135"/>
          <path class="e-bar" fill="#313135"/>
          <path class="e-bar" fill="#313135"/>
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.joe-canvas {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #F5F5F0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  animation: canvas-fade-in 0.8s ease-in both;
}

@keyframes canvas-fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

#joe-scene {
  width: 60%;
  max-width: 420px;
}
</style>