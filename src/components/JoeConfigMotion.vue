<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { gsap } from 'gsap'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'

gsap.registerPlugin(MorphSVGPlugin)

function ellipsePath(cx, cy, rx, ry) {
  return `M${cx - rx},${cy} A${rx},${ry} 0 1,1 ${cx + rx},${cy} A${rx},${ry} 0 1,1 ${cx - rx},${cy} Z`
}

// ─── O animation paths ──────────────────────────────────────────
const CIRCLE_AT_E = ellipsePath(220, 42, 6, 6)
const CIRCLE_AT_O = ellipsePath(127, 42, 6, 6)
const O_PETALS = [
  ellipsePath(127, 14, 22, 16),  // top
  ellipsePath(155, 42, 16, 22),  // right
  ellipsePath(127, 70, 22, 16),  // bottom
  ellipsePath(100, 42, 16, 22),  // left
]

// ─── Assembly shapes (subpaths matching the template rects) ─────
// E: 3 horizontal bars as subpaths
const E_BARS = 'M174,3 H244 V25 H174 Z M174,28 H244 V53 H174 Z M174,56 H244 V82 H174 Z'
// J: 2 blocks as subpaths (stem + base) — matches J_FINAL's 2 subpaths
const J_BARS = 'M0,0 H80 V42 H0 Z M0,42 H80 V84 H0 Z'

// ─── Final shapes from joe-config.svg ────────────────────────────
const E_FINAL = 'M185.633 82V66.2H174V18.8H185.633V3H243.796V50.4H205.165C200.802 50.4 197.265 53.937 197.265 58.3C197.265 62.6631 200.802 66.2 205.165 66.2H243.796V82H185.633ZM197.265 26.7C197.265 31.0631 200.802 34.6 205.165 34.6H224.263C228.626 34.6 232.163 31.0631 232.163 26.7C232.163 22.337 228.626 18.8 224.263 18.8H205.165C200.802 18.8 197.265 22.337 197.265 26.7Z'

const J_FINAL = 'M31.8771 29.514V0L80 0V46.9548C80 67.4098 62.0953 84 40 84C17.9047 84 0 67.4098 0 46.9548V29.514H31.8771ZM31.8771 46.963C31.8771 51.1167 35.515 54.486 40 54.486C44.485 54.486 48.1229 51.1167 48.1229 46.963V29.5222H31.8771V46.963Z'

const canvasRef = ref(null)
let ctx

onMounted(() => {
  ctx = gsap.context(() => {
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2 })

    const ePieces = canvasRef.value.querySelectorAll('.e-piece')
    const jPieces = canvasRef.value.querySelectorAll('.j-piece')
    const petals = canvasRef.value.querySelectorAll('.o-petal-path')

    // ─── Initial state ───────────────────────────────────────────

    // E bars: scattered to the right with vertical spread
    gsap.set(ePieces[0], { x: 110, y: -15 })   // top bar — far right, up
    gsap.set(ePieces[1], { x: 80 })              // mid bar — offset right
    gsap.set(ePieces[2], { x: 110, y: 15 })     // bot bar — far right, down
    gsap.set('#e-morph', { opacity: 0 })
    gsap.set('#e-accent', { opacity: 0 })

    // J blocks: scattered apart
    gsap.set(jPieces[0], { x: -60, y: -30 })    // stem — up-left
    gsap.set(jPieces[1], { x: 40, y: 35 })      // base — down-right
    gsap.set('#j-morph', { opacity: 0 })

    // O petals: tiny circles at E area
    petals.forEach(el => {
      gsap.set(el, { attr: { d: CIRCLE_AT_E }, opacity: 0 })
    })
    gsap.set('#o-final', { opacity: 0 })

    // ═════════════════════════════════════════════════════════════
    // PHASE 1: E — bars slide in → assemble → morph to final E
    // ═════════════════════════════════════════════════════════════

    // Bars slide in with stagger
    tl.to(ePieces[0], { x: 0, y: 0, duration: 1.0, ease: 'power3.out' }, 0)
    tl.to(ePieces[1], { x: 0, duration: 1.0, ease: 'power3.out' }, 0.15)
    tl.to(ePieces[2], { x: 0, y: 0, duration: 1.0, ease: 'power3.out' }, 0.3)

    // Swap: hide rect pieces, show morph path with matching bar shape
    tl.set(ePieces, { opacity: 0 }, 1.1)
    tl.set('#e-morph', { opacity: 1, attr: { d: E_BARS } }, 1.1)

    // Morph: assembled bars → final E letterform
    tl.to('#e-morph', {
      morphSVG: { shape: E_FINAL, map: 'complexity' },
      duration: 1.5, ease: 'sine.inOut'
    }, 1.1)

    // E accent bar fades in after morph
    tl.to('#e-accent', { opacity: 1, duration: 0.3 }, 2.4)

    // ═════════════════════════════════════════════════════════════
    // PHASE 2: O — circles emerge → travel → petals → final O
    // ═════════════════════════════════════════════════════════════

    // Circles emerge from E area
    petals.forEach((el, i) => {
      tl.to(el, { opacity: 1, duration: 0.2 }, 1.0 + i * 0.08)
    })

    // Circles travel to O center
    petals.forEach((el, i) => {
      tl.to(el, {
        morphSVG: { shape: CIRCLE_AT_O, map: 'complexity' },
        duration: 0.6, ease: 'power2.inOut'
      }, 1.3 + i * 0.08)
    })

    // Circles spread into petal ellipses
    petals.forEach((el, i) => {
      tl.to(el, {
        morphSVG: { shape: O_PETALS[i], map: 'complexity' },
        duration: 0.8, ease: 'back.out(1.3)'
      }, 2.1 + i * 0.1)
    })

    // Crossfade petals → final O
    tl.to(petals, { opacity: 0, duration: 0.3 }, 3.1)
    tl.to('#o-final', { opacity: 1, duration: 0.3 }, 3.1)

    // ═════════════════════════════════════════════════════════════
    // PHASE 3: J — blocks slide in → assemble → morph to final J
    // ═════════════════════════════════════════════════════════════

    // J pieces slide in
    tl.to(jPieces[0], { x: 0, y: 0, duration: 1.0, ease: 'power3.out' }, 1.6)
    tl.to(jPieces[1], { x: 0, y: 0, duration: 1.0, ease: 'power3.out' }, 1.8)

    // Swap: hide rect pieces, show morph path with matching bar shape
    tl.set(jPieces, { opacity: 0 }, 2.7)
    tl.set('#j-morph', { opacity: 1, attr: { d: J_BARS } }, 2.7)

    // Morph: assembled blocks → final J letterform
    tl.to('#j-morph', {
      morphSVG: { shape: J_FINAL, map: 'complexity' },
      duration: 1.5, ease: 'sine.inOut'
    }, 2.7)

    // ═════════════════════════════════════════════════════════════
    // Scene drift + fade out
    // ═════════════════════════════════════════════════════════════
    tl.fromTo('#config-scene', { x: 8 }, { x: -8, duration: 5.5, ease: 'power2.inOut' }, 0)
    tl.to('#config-scene', { opacity: 0, duration: 0.3 }, '+=1.5')

  }, canvasRef.value)
})

onUnmounted(() => {
  ctx?.revert()
})
</script>

<template>
  <div ref="canvasRef" class="config-canvas">
    <svg id="config-scene" viewBox="-20 -20 290 124" xmlns="http://www.w3.org/2000/svg">

      <!-- ══ J ══ -->
      <!-- Assembly pieces (visible during slide-in) -->
      <rect class="j-piece" x="0" y="0" width="80" height="42" fill="#E1E1E1" />
      <rect class="j-piece" x="0" y="42" width="80" height="42" fill="#E1E1E1" />
      <!-- Morph path (hidden → swapped in → morphs to final J) -->
      <path id="j-morph" fill-rule="evenodd" fill="#E1E1E1" />

      <!-- ══ O ══ -->
      <path class="o-petal-path" fill="#E1E1E1" />
      <path class="o-petal-path" fill="#E1E1E1" />
      <path class="o-petal-path" fill="#E1E1E1" />
      <path class="o-petal-path" fill="#E1E1E1" />
      <path id="o-final" fill-rule="evenodd"
        d="M135.247 0C146.206 0 153.499 8.05381 151.549 18.0014C151.248 19.5526 150.732 21.0496 150.048 22.4835C152.182 21.5275 154.408 21.0048 156.624 21.0048C166.017 21.0049 171.784 30.4023 169.501 42.0003C167.226 53.5968 157.768 62.9929 148.377 62.9952C146.154 62.9945 144.138 62.4718 142.381 61.5165C142.506 62.9505 142.423 64.4479 142.123 65.9991C140.172 75.9375 129.705 83.9999 118.753 84C107.802 84 100.501 75.9466 102.451 65.9991C102.751 64.4479 103.268 62.9505 103.951 61.5165C101.818 62.4725 99.5924 62.9957 97.3755 62.9957C87.9828 62.9957 82.2157 53.5982 84.4992 42.0003C86.7745 30.4022 96.234 21.0048 105.627 21.0048C107.852 21.0048 109.869 21.5276 111.619 22.4835C111.494 21.0496 111.577 19.5526 111.877 18.0014C113.828 8.05387 124.295 9.22336e-05 135.247 0ZM138.564 33.5857C135.347 35.1188 131.78 35.9935 128.171 35.9936C124.562 35.9936 121.345 35.1188 118.728 33.5857C119.137 36.1559 119.078 39.0058 118.495 41.991C117.911 44.9762 116.844 47.8265 115.428 50.3968C118.645 48.8636 122.212 47.9884 125.821 47.9883C129.429 47.9883 132.647 48.8636 135.264 50.3968C134.855 47.8265 134.914 44.9852 135.497 41.991C136.08 39.0058 137.147 36.1559 138.564 33.5857Z"
        fill="#E1E1E1" />

      <!-- ══ E ══ -->
      <!-- Assembly pieces (visible during slide-in) -->
      <rect class="e-piece" x="174" y="3" width="70" height="22" fill="#E1E1E1" />
      <rect class="e-piece" x="174" y="28" width="70" height="25" fill="#E1E1E1" />
      <rect class="e-piece" x="174" y="56" width="70" height="26" fill="#E1E1E1" />
      <!-- Morph path (hidden → swapped in → morphs to final E) -->
      <path id="e-morph" fill="#E1E1E1" />
      <!-- E accent bar -->
      <path id="e-accent" d="M243.796 11.6575H250V39.7945H243.796V11.6575Z" fill="#E1E1E1" />

    </svg>
  </div>
</template>

<style scoped>
.config-canvas {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

#config-scene {
  width: 70%;
  max-width: 700px;
}
</style>
