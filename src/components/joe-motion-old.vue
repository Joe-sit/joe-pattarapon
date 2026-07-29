<script setup>
import { onMounted } from 'vue'
import { gsap } from 'gsap'
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin'

gsap.registerPlugin(MorphSVGPlugin)

// ─── Bubble shapes ───────────────────────────────────────────────────────────
const J_ARC_BUBBLE = 'M320,0 C354.25,0 382,27.75 382,62 C382,96.25 354.25,124 320,124 C285.75,124 258,96.25 258,62 C258,27.75 285.75,0 320,0 Z'
const J_STEM_BUBBLE = 'M320,0 L382,0 L382,62 L320,62 Z'

// ─── J shapes ────────────────────────────────────────────────────────────────
const J_ARC_START = 'M62,0 C96.25,0 124,27.75 124,62 C124,96.25 96.25,124 62,124 C27.75,124 0,96.25 0,62 C0,27.75 27.75,0 62,0 Z'
const J_STEM_START = 'M62,0 L124,0 L124,62 L62,62 Z'
const J_ARC_FINAL = 'M124 62C124 70.142 122.396 78.2042 119.281 85.7264C116.165 93.2486 111.598 100.083 105.841 105.841C100.083 111.598 93.2486 116.165 85.7264 119.281C78.2042 122.396 70.142 124 62 124C53.858 124 45.7958 122.396 38.2736 119.281C30.7514 116.165 23.9166 111.598 18.1594 105.841C12.4021 100.083 7.83526 93.2486 4.71947 85.7264C1.60368 78.2042 -7.11792e-07 70.142 0 62L62 62H124Z'
const J_STEM_FINAL = 'M64.6387 42C64.6387 18.804 83.4427 0 106.639 0H124V62H64.6387V42Z'

// ─── + icon arms (at O center 210,62) ────────────────────────────────────────
const PLUS_ARMS = [
  'M207,44 H213 V62 H207 Z',
  'M210,59 H228 V65 H210 Z',
  'M207,62 H213 V80 H207 Z',
  'M192,59 H210 V65 H192 Z',
]

// ─── Cursor line segments (at 210,62 — same center as +) ────────────────────
const CURSOR_LINES = [
  'M209,20 H211 V41 H209 Z',
  'M209,41 H211 V62 H209 Z',
  'M209,62 H211 V83 H209 Z',
  'M209,83 H211 V104 H209 Z',
]

// ─── White star/sparkle (single path — exact negative space between petals) ──
const STAR_PATH = 'M210.004,0 C210.002,8.143 208.396,16.207 205.279,23.729 C202.162,31.252 197.595,38.087 191.837,43.844 C186.08,49.601 179.245,54.167 171.723,57.282 C164.202,60.396 156.141,62 148,62 C148.001,70.14 149.606,78.205 152.722,85.728 C155.839,93.252 160.406,100.087 166.164,105.845 C171.922,111.603 178.757,116.17 186.279,119.285 C193.801,122.4 201.862,124.002 210.004,124 C218.144,124 226.205,122.398 233.726,119.282 C241.248,116.167 248.082,111.6 253.839,105.843 C259.596,100.085 264.162,93.25 267.279,85.726 C270.394,78.206 271.998,70.145 272,62 C271.999,53.862 270.394,45.796 267.279,38.274 C264.162,30.751 259.596,23.915 253.839,18.157 C248.082,12.4 241.248,7.833 233.726,4.718 C226.205,1.602 218.144,0 210.004,0Z'

// ─── O shapes (single combined path — circle quarters → final wedges) ────────
const O_CIRCLE_START = [
  'M210,0 A62,62,0,0,0,148,62 L210,62 Z',
  'M210,0 A62,62,0,0,1,272,62 L210,62 Z',
  'M148,62 A62,62,0,0,0,210,124 L210,62 Z',
  'M272,62 A62,62,0,0,1,210,124 L210,62 Z',
].join(' ')

const O_FINAL = [
  'M210.004 0C201.862 0 193.8 1.59882 186.278 4.71351C178.755 7.8282 171.92 12.3949 166.162 18.1528C160.404 23.9106 155.836 30.7468 152.72 38.2708C149.605 45.7926 148.001 53.8546 148 62C156.141 62 164.202 60.3962 171.723 57.2817C179.245 54.1671 186.08 49.601 191.837 43.8441C197.595 38.0872 202.162 31.2522 205.279 23.7294C208.396 16.2066 210.002 8.14339 210.004 0Z',
  'M210.004 0C210.005 8.14339 211.609 16.2068 214.725 23.73C217.841 31.2531 222.408 38.0886 228.165 43.8462C233.922 49.6038 240.756 54.1707 248.277 57.2861C255.798 60.4016 263.859 62.0046 272 62C271.999 53.8615 270.394 45.7957 267.279 38.2736C264.162 30.7505 259.596 23.915 253.839 18.1574C248.082 12.3999 241.248 7.83298 233.726 4.71752C226.205 1.60207 218.144 0 210.004 0Z',
  'M210.004 124C210.003 115.856 208.398 107.792 205.281 100.268C202.165 92.7447 197.597 85.9089 191.84 80.1513C186.082 74.3936 179.247 69.8269 171.725 66.7118C164.203 63.5968 156.141 61.9945 148 62C148.001 70.1398 149.606 78.205 152.722 85.728C155.839 93.2516 160.406 100.087 166.164 105.845C171.922 111.603 178.757 116.17 186.279 119.285C193.801 122.4 201.862 124.002 210.004 124Z',
  'M267.279 85.7264C270.394 78.2055 271.998 70.1446 272 62C255.561 62 239.794 68.5322 228.167 80.1585C216.541 91.7849 210.007 107.555 210.004 124C218.144 124 226.205 122.398 233.726 119.282C241.248 116.167 248.082 111.6 253.839 105.843C259.596 100.085 264.162 93.2495 267.279 85.7264Z',
].join(' ')

// ─── E shapes ────────────────────────────────────────────────────────────────
const E_START = [
  'M420,0   H296 V24.8 H420 Z',
  'M420,24.8 H296 V49.6 H420 Z',
  'M420,49.6 H296 V74.4 H420 Z',
  'M420,74.4 H296 V99.2 H420 Z',
  'M420,99.2 H296 V124  H420 Z',
]
const E_FINAL = [
  'M420 0H296V2H420V0Z',
  'M420 6H296V10H420V6Z',
  'M420 14H296V20H420V14Z',
  'M420 24H296V32H420V24Z',
  'M420 36H296V124H420V36Z',
]

const SLIDE = 140

// ─── Dynamic bubble path (grows left from right edge 382) ────────────────────
function makeBubbleArc(textWidth, rightEdge = 382) {
  const r = 62
  const totalW = Math.max(textWidth + 60, 2 * r)
  const left = rightEdge - totalW
  const rightCap = rightEdge - r
  return `M${left + r},0 H${rightCap} A62,62 0 0 1 ${rightEdge},62 A62,62 0 0 1 ${rightCap},124 H${left + r} A62,62 0 0 1 ${left},62 A62,62 0 0 1 ${left + r},0 Z`
}

onMounted(() => {
  const bubbleText = document.getElementById('bubble-text')
  const cursor = document.getElementById('bubble-cursor')
  const plusGroup = document.getElementById('plus-group')
  const plusArms = document.querySelectorAll('.plus-arm')
  // ─── Initial state ──────────────────────────────────────────────────────────
  gsap.set('#j-arc-p', { attr: { d: J_ARC_BUBBLE } })
  gsap.set('#j-stem-p', { attr: { d: J_STEM_BUBBLE } })
  plusArms.forEach((el, i) => gsap.set(el, { attr: { d: PLUS_ARMS[i] } }))
  gsap.set('#plus-group', { x: 110 })
  gsap.set('#bubble-enter', { x: -350, y: 100 })
  gsap.set('#e-group', { y: SLIDE })
  document.querySelectorAll('.e-bar').forEach((el, i) => gsap.set(el, { attr: { d: E_START[i] } }))
  gsap.set('#o-path', { attr: { d: O_CIRCLE_START } })
  gsap.set('#o-group', { opacity: 0 })
  gsap.set('#star-path', { attr: { d: STAR_PATH }, opacity: 0 })
  bubbleText.textContent = ''
  gsap.set('#bubble-text', { opacity: 0 })
  cursor.style.display = 'none'
  gsap.set('#joe-scene', { x: 0 })

  // ─── Typing setup ──────────────────────────────────────────────────────────
  const GREETING = "Welcome\u{1F44B}, make yourself at home."
  const chars = Array.from(GREETING)
  const PART1_END = 8
  const THINK_PAUSE = 0.6

  function charDelay(ch) {
    if (ch === ' ') return 0.03
    if ('.,!?'.includes(ch)) return 0.02
    return 0.055 + Math.random() * 0.02
  }

  let cum = 0
  const charTimes = []
  for (let i = 0; i < chars.length; i++) {
    if (i === PART1_END) cum += THINK_PAUSE
    charTimes.push(cum)
    cum += charDelay(chars[i])
  }
  const totalTypeTime = cum

  // ─── Helper: update bubble to fit text ──────────────────────────────────────
  function updateBubble(text, rightEdge = 382) {
    bubbleText.textContent = text
    if (!text) {
      // Collapse to small circle at whatever rightEdge is
      const left = rightEdge - 124
      const arcD = `M${left + 62},0 H${rightEdge - 62} A62,62 0 0 1 ${rightEdge},62 A62,62 0 0 1 ${rightEdge - 62},124 H${left + 62} A62,62 0 0 1 ${left},62 A62,62 0 0 1 ${left + 62},0 Z`
      gsap.set('#j-arc-p', { attr: { d: arcD } })
      gsap.set('#j-stem-p', { attr: { d: `M${rightEdge - 62},0 L${rightEdge},0 L${rightEdge},62 L${rightEdge - 62},62 Z` } })
      gsap.set('#bubble-text', { opacity: 0 })
      return
    }
    gsap.set('#bubble-text', { opacity: 1 })
    const bbox = bubbleText.getBBox()
    const textW = bbox.width
    gsap.set('#j-arc-p', { attr: { d: makeBubbleArc(textW, rightEdge) } })
    // Keep stem tucked inside the arc (top-right quadrant of the right cap)
    gsap.set('#j-stem-p', { attr: { d: `M${rightEdge - 62},0 L${rightEdge},0 L${rightEdge},62 L${rightEdge - 62},62 Z` } })
    const totalW = Math.max(textW + 60, 124)
    const centerX = rightEdge - totalW / 2
    bubbleText.setAttribute('x', String(centerX))
    cursor.setAttribute('x', String(centerX + textW / 2 + 4))
  }

  // ─── Timeline timings ──────────────────────────────────────────────────────
  const tEnter = 0.1
  const tClick = 0.9
  const tCursorMrph = tClick + 0.1
  const TYPE_START = tClick + 0.4
  const typeEnd = TYPE_START + totalTypeTime
  const DEL_START = typeEnd + 1.0
  const DEL_DUR = 0.8

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 2 })

  // ─── Reset ─────────────────────────────────────────────────────────────────
  tl.call(() => {
    bubbleText.textContent = ''
    gsap.set('#bubble-text', { opacity: 0 })
    cursor.style.display = 'none'
    plusGroup.style.display = ''
    plusGroup.classList.remove('cursor-blink')
    gsap.set('#bubble-enter', { x: -350, y: 100, scale: 1 })
    gsap.set('#j-arc-p', { attr: { d: J_ARC_BUBBLE } })
    gsap.set('#j-stem-p', { attr: { d: J_STEM_BUBBLE } })
    gsap.set('#plus-group', { x: 110 })
    plusArms.forEach((el, i) => {
      gsap.set(el, { attr: { d: PLUS_ARMS[i] }, fill: 'white', rotation: 0 })
    })
    gsap.set('#o-path', { attr: { d: O_CIRCLE_START } })
    gsap.set('#o-group', { opacity: 0, rotation: 0, svgOrigin: '210 62' })
    gsap.set('#star-path', { opacity: 0 })
    gsap.set('#joe-scene', { x: 0 })
    document.querySelectorAll('.e-bar').forEach((el, i) => {
      gsap.set(el, { attr: { d: E_START[i] } })
    })
    gsap.set('#e-group', { y: SLIDE })
  }, null, 0)

  // ─── Phase 0: Entrance from bottom-left ────────────────────────────────────
  tl.to('#bubble-enter', { x: 0, y: 0, duration: 0.8, ease: 'power2.out' }, tEnter)

  // ─── Phase 0.5: Click bounce ───────────────────────────────────────────────
  tl.to('#bubble-enter', { scale: 0.85, svgOrigin: '320 62', duration: 0.08, ease: 'power2.in' }, tClick)
  tl.to('#bubble-enter', { scale: 1, svgOrigin: '320 62', duration: 0.2, ease: 'back.out(3)' }, tClick + 0.08)

  // ─── Phase 1: + morphs to cursor ──────────────────────────────────────────
  plusArms.forEach((el, i) => {
    tl.to(el, { morphSVG: CURSOR_LINES[i], duration: 0.3, ease: 'power2.inOut' }, tCursorMrph)
  })
  tl.call(() => { plusGroup.classList.add('cursor-blink') }, null, tCursorMrph + 0.3)

  // ─── Phase 2: Swap to text cursor, start typing ───────────────────────────
  tl.call(() => {
    plusGroup.style.display = 'none'
    cursor.style.display = ''
    cursor.setAttribute('x', '320')
    cursor.setAttribute('text-anchor', 'start')
  }, null, TYPE_START - 0.05)

  chars.forEach((_, i) => {
    tl.call(() => {
      updateBubble(chars.slice(0, i + 1).join(''))
      cursor.style.display = ''
    }, null, TYPE_START + charTimes[i])
  })

  // Hide cursor after typing, pause
  tl.call(() => { cursor.style.display = 'none' }, null, typeEnd + 0.5)

  // ─── Phase 3: Text deletion + smooth bubble collapse leftward ──────────────
  const DEL_CHAR_DELAY = 0.025
  const delTextDur = chars.length * DEL_CHAR_DELAY
  // Bubble collapse duration = whichever is longer: text deletion or minimum smooth morph
  const collapseDur = Math.max(delTextDur, DEL_DUR)

  tl.call(() => { cursor.style.display = '' }, null, DEL_START)

  // Delete characters one by one (text only, no path changes)
  for (let i = chars.length - 1; i >= 0; i--) {
    const t = DEL_START + (chars.length - 1 - i) * DEL_CHAR_DELAY
    tl.call(() => {
      const text = chars.slice(0, i).join('')
      bubbleText.textContent = text
      if (!text) {
        gsap.set('#bubble-text', { opacity: 0 })
        cursor.style.display = 'none'
      }
    }, null, t)
  }

  // Smooth morphSVG: bubble arc → J circle at left position
  tl.to('#j-arc-p', { morphSVG: J_ARC_START, duration: collapseDur, ease: 'power2.inOut' }, DEL_START)
  tl.to('#j-stem-p', { morphSVG: J_STEM_START, duration: collapseDur, ease: 'power2.inOut' }, DEL_START)

  // Slide + group leftward during collapse (110 → 0)
  tl.to('#plus-group', { x: 0, duration: collapseDur, ease: 'power2.inOut' }, DEL_START)

  // Slide text position leftward to stay roughly centered in shrinking bubble
  tl.to(bubbleText, { attr: { x: 62 }, duration: collapseDur, ease: 'power2.inOut' }, DEL_START)
  tl.to(cursor, { attr: { x: 62 }, duration: collapseDur, ease: 'power2.inOut' }, DEL_START)

  const collapseEnd = DEL_START + collapseDur
  tl.call(() => {
    bubbleText.textContent = ''
    gsap.set('#bubble-text', { opacity: 0 })
    cursor.style.display = 'none'
    plusGroup.style.display = ''
    plusGroup.classList.remove('cursor-blink')
  }, null, collapseEnd)

  // ─── Phase 4: Cursor morphs back to + ─────────────────────────────────────
  const tPlusMrph = collapseEnd + 0.1
  const tToJ = collapseEnd + 0.15
  plusArms.forEach((el, i) => {
    tl.to(el, { morphSVG: PLUS_ARMS[i], duration: 0.3, ease: 'power2.inOut' }, tPlusMrph)
  })

  // ─── O: hide plus, show circle, spin 360° + morph to final wedges ─────────
  const tOm = tToJ + 0.4
  // Hide plus arms, show O circle
  tl.call(() => { plusGroup.style.display = 'none' }, null, tOm)
  tl.to('#o-group', { opacity: 1, duration: 0.3 }, tOm)
  // Spin and morph (from reference)
  tl.to('#o-group', { rotation: 360, svgOrigin: '210 62', duration: 2.0, ease: 'power2.inOut' }, tOm)
  tl.to('#o-path', { morphSVG: { shape: O_FINAL, map: 'complexity' }, duration: 2.0, ease: 'sine.inOut' }, tOm)
  // White star sparkle fades in behind petals
  tl.to('#star-path', { opacity: 1, duration: 1.2, ease: 'power1.in' }, tOm + 0.5)

  // ─── Phase 6: J morphs to final ───────────────────────────────────────────
  const tJm = tToJ + 0.8
  tl.to('#j-stem-p', {
    morphSVG: { shape: J_STEM_FINAL, map: 'complexity' },
    duration: 1.8, ease: 'sine.inOut',
  }, tJm)
  tl.to('#j-arc-p', {
    morphSVG: { shape: J_ARC_FINAL, map: 'complexity' },
    duration: 2.0, ease: 'sine.inOut',
  }, tJm + 0.1)

  // ─── Phase 7: E slides in and morphs ──────────────────────────────────────
  const tE = tToJ + 0.6
  tl.to('#e-group', { y: 0, duration: 1.4, ease: 'power3.out' }, tE)
  const tEm = tE + 0.3
  document.querySelectorAll('.e-bar').forEach((el, i) => {
    tl.to(el, {
      morphSVG: { shape: E_FINAL[i], map: 'complexity' },
      duration: 1.4, ease: 'sine.inOut',
    }, tEm + i * 0.1)
  })

  // ─── Scene drift ──────────────────────────────────────────────────────────
  tl.to('#joe-scene', { x: -20, duration: 4.0, ease: 'power1.inOut' }, tToJ)
})
</script>

<template>
  <div class="joe-canvas">
    <svg id="joe-scene" viewBox="0 0 420 124" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <clipPath id="clip-e">
          <rect x="266" y="-30" width="184" height="324" />
        </clipPath>
      </defs>

      <g id="bubble-enter">
        <g id="j-group">
          <path id="j-arc-p" fill="#6463ED" />
          <path id="j-stem-p" fill="#6463ED" />
        </g>

        <text id="bubble-text" x="320" y="62" text-anchor="middle" dy="0.35em" fill="white" font-size="15"
          font-weight="600" opacity="0" style="font-family: 'Funnel Display', sans-serif"></text>
        <text id="bubble-cursor" x="320" y="62" text-anchor="start" dy="0.35em" fill="white" font-size="15"
          font-weight="300" style="font-family: 'Funnel Display', sans-serif; display: none"
          class="cursor-blink">|</text>

        <!-- + icon → cursor (white) -->
        <g id="plus-group">
          <path class="plus-arm" fill="white" />
          <path class="plus-arm" fill="white" />
          <path class="plus-arm" fill="white" />
          <path class="plus-arm" fill="white" />
        </g>
      </g>

      <!-- O: circle spins and morphs into design wedges -->
      <g id="o-group">
        <path id="star-path" fill="white" opacity="0" />
        <path id="o-path" fill="#FFBC01" />
      </g>

      <g clip-path="url(#clip-e)">
        <g id="e-group">
          <path class="e-bar" fill="#FF8CD5" />
          <path class="e-bar" fill="#FF8CD5" />
          <path class="e-bar" fill="#FF8CD5" />
          <path class="e-bar" fill="#FF8CD5" />
          <path class="e-bar" fill="#FF8CD5" />
        </g>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.joe-canvas {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000000;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

#joe-scene {
  width: 60%;
  max-width: 420px;
}

.cursor-blink path,
.cursor-blink {
  animation: blink 0.6s steps(2, start) infinite;
}

@keyframes blink {
  to {
    opacity: 0;
  }
}
</style>
