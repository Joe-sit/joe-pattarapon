<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import { gsap } from 'gsap'

const canvasRef = ref(null)
const tracksRef = ref(null)
const playheadPos = ref(0)
const currentTime = ref('0.00')
const isPlaying = ref(true)
const isAnalog = ref(false)
let ctx
let mainTl = null
const segments = ref([])
const exportedData = ref('')

// O petal data
const petalData = [
  { cx: 119.717, cy: 62.9484, rot: 59.365 },
  { cx: 128.342, cy: 20.4592, rot: 59.365 },
  { cx: 101.732, cy: 41.2846, rot: 28.5804 },
  { cx: 146.851, cy: 41.4516, rot: 28.5804 },
]

// Drag state
let dragInfo = null

function seg(label) {
  const s = segments.value.find(s => s.label === label)
  if (!s) return { start: 0, dur: 0 }
  return { start: s.start, dur: s.end - s.start }
}

function buildTimeline() {
  if (!canvasRef.value) return
  const wasPlaying = isPlaying.value
  const prevTime = mainTl ? mainTl.time() : 0

  // Kill old timeline
  if (mainTl) {
    mainTl.kill()
    mainTl = null
  }

  // Reset all elements to initial state
  gsap.set('#e-clip-rect', { attr: { x: 180, width: 4 } })
  gsap.set('#e-counter', { scaleX: 0, svgOrigin: '191 26' })
  gsap.set('#e-opening', { x: 60 })
  gsap.set('#e-front', { scaleX: 0, svgOrigin: '238 24.5' })
  gsap.set('#o-bullet', { opacity: 0, attr: { cx: 175, r: 1 } })
  canvasRef.value.querySelectorAll('.o-petal').forEach((el) => {
    gsap.set(el, { attr: { cx: 124, cy: 42 }, rotation: 0, opacity: 0 })
  })
  gsap.set('#j-body', { y: -100 })
  gsap.set('#j-mask', { scale: 0, svgOrigin: '41 42' })
  gsap.set('#j-corner', { scale: 0, svgOrigin: '0 0' })
  gsap.set('#letters-scene', { opacity: 1 })

  mainTl = gsap.timeline({
    repeat: -1, repeatDelay: 0,
    onUpdate: function () {
      const t = this.time()
      const d = this.duration()
      playheadPos.value = (t / d) * 100
      currentTime.value = t.toFixed(2)
    }
  })
  const tl = mainTl
  const petals = canvasRef.value.querySelectorAll('.o-petal')

  // ── E animation ──
  const bodyE = seg('body-e')
  tl.to('#e-clip-rect', {
    attr: { width: 77 },
    duration: bodyE.dur, ease: 'power2.inOut'
  }, bodyE.start)

  const upperE = seg('upper-e')
  tl.to('#e-counter', {
    scaleX: 1, duration: upperE.dur, ease: 'power2.inOut'
  }, upperE.start)

  const frontE = seg('front-e')
  tl.to('#e-front', {
    scaleX: 1, duration: frontE.dur, ease: 'power2.inOut'
  }, frontE.start)

  const lowerE = seg('lower-e')
  tl.to('#e-opening', {
    x: 0, duration: lowerE.dur, ease: 'power2.inOut'
  }, lowerE.start)

  const backE = seg('back-e')
  tl.to('#e-clip-rect', {
    attr: { x: 168 },
    duration: backE.dur, ease: 'power2.inOut'
  }, backE.start)

  // ── O animation ──
  const bullet = seg('bullet')
  tl.set('#o-bullet', { opacity: 1 }, bullet.start)
  tl.to('#o-bullet', {
    attr: { cx: 124, r: 20 },
    duration: bullet.dur, ease: 'power2.out'
  }, bullet.start)

  const petalsIn = seg('petals-in')
  tl.to('.o-petal', {
    opacity: 1, duration: petalsIn.dur, ease: 'power2.inOut'
  }, petalsIn.start)

  const petalsSpread = seg('petals-spread')
  petals.forEach((el, i) => {
    const p = petalData[i]
    tl.to(el, {
      attr: { cx: p.cx, cy: p.cy },
      duration: petalsSpread.dur, ease: 'power2.inOut'
    }, petalsSpread.start)
  })

  // Bullet fades as petals spread
  tl.to('#o-bullet', {
    opacity: 0, duration: 0.2, ease: 'power2.inOut'
  }, petalsIn.start + 0.15)

  const petalsRotate = seg('petals-rotate')
  petals.forEach((el, i) => {
    const p = petalData[i]
    tl.to(el, {
      rotation: p.rot,
      svgOrigin: `${p.cx} ${p.cy}`,
      duration: petalsRotate.dur, ease: 'power2.inOut'
    }, petalsRotate.start)
  })

  // ── J animation ──
  const jBody = seg('j-body')
  tl.to('#j-body', {
    y: 0, duration: jBody.dur, ease: 'power2.inOut'
  }, jBody.start)

  const jCorner = seg('j-corner')
  tl.to('#j-corner', {
    scale: 1, duration: jCorner.dur, ease: 'power2.inOut'
  }, jCorner.start)

  const jMask = seg('j-mask')
  tl.to('#j-mask', {
    scale: 1, duration: jMask.dur, ease: 'power2.inOut'
  }, jMask.start)

  // Hold + fade
  const holdFade = seg('hold+fade')
  if (holdFade.dur > 0) {
    tl.to('#letters-scene', { opacity: 0, duration: 0.4, ease: 'power1.in' }, holdFade.start)
  }

  // Reset at end
  tl.set('#letters-scene', { opacity: 1 })
  tl.set('#j-body', { y: -100 })
  tl.set('#j-mask', { scale: 0 })
  tl.set('#j-corner', { scale: 0 })
  tl.set('#e-clip-rect', { attr: { x: 180, width: 4 } })
  tl.set('#e-counter', { scaleX: 0 })
  tl.set('#e-opening', { x: 60 })
  tl.set('#e-front', { scaleX: 0 })
  tl.set('#o-bullet', { opacity: 0, attr: { cx: 175, r: 1 } })
  petals.forEach((el) => {
    tl.set(el, { attr: { cx: 124, cy: 42 }, rotation: 0, opacity: 0 })
  })

  // Restore playback state
  if (prevTime > 0 && prevTime < tl.duration()) {
    tl.time(prevTime)
  }
  if (!wasPlaying) {
    tl.pause()
  }
}

function onTrackMouseDown(e) {
  if (isAnalog.value) {
    const segEl = e.target.closest('.timeline-segment')
    if (!segEl) return
    const i = parseInt(segEl.dataset.index)
    const s = segments.value[i]
    const segRect = segEl.getBoundingClientRect()
    const xInSeg = e.clientX - segRect.left
    const edgeZone = 8

    let mode = 'move'
    if (xInSeg < edgeZone) mode = 'resize-left'
    else if (xInSeg > segRect.width - edgeZone) mode = 'resize-right'

    dragInfo = {
      segIndex: i, mode,
      startX: e.clientX,
      origStart: s.start,
      origEnd: s.end,
    }
    e.preventDefault()
  } else {
    if (!mainTl) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    const time = pct * mainTl.duration()
    mainTl.pause()
    mainTl.time(time)
    isPlaying.value = false
  }
}

function onTrackMouseMove(e) {
  if (isAnalog.value && dragInfo && e.buttons === 1) {
    const rect = tracksRef.value.getBoundingClientRect()
    const totalWidth = rect.width
    const maxEnd = Math.max(...segments.value.map(s => s.end)) + 0.1
    const pxPerSec = totalWidth / maxEnd
    const dx = e.clientX - dragInfo.startX
    const dt = dx / pxPerSec
    const s = segments.value[dragInfo.segIndex]

    if (dragInfo.mode === 'move') {
      const newStart = Math.max(0, dragInfo.origStart + dt)
      const dur = dragInfo.origEnd - dragInfo.origStart
      s.start = parseFloat(newStart.toFixed(2))
      s.end = parseFloat((newStart + dur).toFixed(2))
    } else if (dragInfo.mode === 'resize-left') {
      const newStart = Math.max(0, Math.min(dragInfo.origEnd - 0.05, dragInfo.origStart + dt))
      s.start = parseFloat(newStart.toFixed(2))
    } else if (dragInfo.mode === 'resize-right') {
      const newEnd = Math.max(s.start + 0.05, dragInfo.origEnd + dt)
      s.end = parseFloat(newEnd.toFixed(2))
    }
    recalcSegmentPcts()
  } else if (!isAnalog.value && e.buttons === 1 && mainTl) {
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    mainTl.time(pct * mainTl.duration())
  }
}

function onTrackMouseUp() {
  if (dragInfo) {
    dragInfo = null
    buildTimeline() // rebuild on drag end
  }
}

function togglePlay() {
  if (!mainTl) return
  if (isPlaying.value) {
    mainTl.pause()
  } else {
    mainTl.play()
  }
  isPlaying.value = !isPlaying.value
}

function toggleAnalog() {
  isAnalog.value = !isAnalog.value
  if (isAnalog.value && mainTl) {
    mainTl.pause()
    isPlaying.value = false
  }
}

function updateSegStart(i, e) {
  const val = parseFloat(e.target.value)
  if (isNaN(val)) return
  const s = segments.value[i]
  const dur = s.end - s.start
  s.start = val
  s.end = val + dur
  recalcSegmentPcts()
  buildTimeline()
}

function updateSegDur(i, e) {
  const val = parseFloat(e.target.value)
  if (isNaN(val)) return
  const s = segments.value[i]
  s.end = s.start + val
  recalcSegmentPcts()
  buildTimeline()
}

function recalcSegmentPcts() {
  const maxEnd = Math.max(...segments.value.map(s => s.end))
  const totalDur = maxEnd + 0.1
  segments.value.forEach(s => {
    s.leftPct = (s.start / totalDur) * 100
    s.widthPct = Math.max(((s.end - s.start) / totalDur) * 100, 0.5)
  })
}

function exportTimeline() {
  const data = segments.value.map(s => ({
    label: s.label,
    start: parseFloat(s.start.toFixed(2)),
    duration: parseFloat((s.end - s.start).toFixed(2)),
  }))
  exportedData.value = JSON.stringify(data, null, 2)
  navigator.clipboard.writeText(exportedData.value)
}

onMounted(() => {
  const totalDur = 5.4

  // Initialize segments (source of truth for all timing)
  segments.value = [
    { label: 'body-e', start: 0, end: 1.8, color: '#4a9' },
    { label: 'upper-e', start: 0.54, end: 1.44, color: '#4a9' },
    { label: 'front-e', start: 0.9, end: 1.44, color: '#4a9' },
    { label: 'lower-e', start: 0.63, end: 1.71, color: '#4a9' },
    { label: 'back-e', start: 1.26, end: 1.8, color: '#4a9' },
    { label: 'bullet', start: 1.64, end: 2.36, color: '#e94' },
    { label: 'petals-in', start: 2.09, end: 2.31, color: '#e94' },
    { label: 'petals-spread', start: 1.96, end: 2.85, color: '#e94' },
    { label: 'petals-rotate', start: 2.02, end: 3.9, color: '#e94' },
    { label: 'j-body', start: 1.76, end: 4.29, color: '#49e' },
    { label: 'j-corner', start: 2.33, end: 3.75, color: '#49e' },
    { label: 'j-mask', start: 2, end: 4.78, color: '#49e' },
    { label: 'hold+fade', start: 5, end: 5.4, color: '#666' },
  ].map(s => ({
    ...s,
    leftPct: (s.start / totalDur) * 100,
    widthPct: Math.max(((s.end - s.start) / totalDur) * 100, 0.5),
  }))

  ctx = gsap.context(() => {
    buildTimeline()
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
        <clipPath id="j-reveal">
          <rect id="j-clip-rect" x="-1" y="-1" width="83" height="1" />
        </clipPath>
        <clipPath id="e-reveal">
          <rect data-name="back-e" id="e-clip-rect" x="180" y="0" width="4" height="84" />
        </clipPath>
      </defs>

      <!-- J -->
      <g data-name="j-letter">
        <path data-name="j-body" id="j-body" d="M0 0H81V43.5C81 65.8675 62.8675 84 40.5 84V84C18.1325 84 0 65.8675 0 43.5V0Z" fill="#E1E1E1" />
        <path data-name="j-mask" id="j-mask" d="M41 55C36.5817 55 33 51.4183 33 47L33 30L49 30L49 47C49 51.4183 45.4183 55 41 55V55Z" fill="black" />
        <rect data-name="j-corner" id="j-corner" x="-1" y="-1" width="35" height="32" fill="black" />
      </g>

      <!-- O -->
      <g data-name="o-letter" id="o-petals">
        <ellipse class="o-petal" data-name="o-petal-1" cx="119.717" cy="62.9484" rx="15.1684" ry="18.4624" fill="#E1E1E1" />
        <ellipse class="o-petal" data-name="o-petal-2" cx="128.342" cy="20.4592" rx="15.1684" ry="18.4624" fill="#E1E1E1" />
        <ellipse class="o-petal" data-name="o-petal-3" cx="101.732" cy="41.2846" rx="14.1752" ry="19.4078" fill="#E1E1E1" />
        <ellipse class="o-petal" data-name="o-petal-4" cx="146.851" cy="41.4516" rx="14.1752" ry="19.4078" fill="#E1E1E1" />
      </g>

      <!-- O bullet (outside clip, hidden until needed) -->
      <circle data-name="o-bullet" id="o-bullet" cx="175" cy="42" r="1" fill="#E1E1E1" />

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
      <text x="57" y="18" fill="#666" font-size="4" font-family="monospace" text-anchor="middle">j-body</text>
      <text x="16" y="18" fill="#666" font-size="3" font-family="monospace" text-anchor="middle">j-corner</text>
      <text x="41" y="44" fill="#666" font-size="3" font-family="monospace" text-anchor="middle">j-mask</text>
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
  <!-- Debug Timeline -->
  <div class="timeline-debug">
    <div class="timeline-header">
      <button class="timeline-btn" @click="togglePlay">{{ isPlaying ? '⏸' : '▶' }}</button>
      <span class="timeline-time">{{ currentTime }}s</span>
      <button class="timeline-btn" :class="{ 'timeline-analog-active': isAnalog }" @click="toggleAnalog">{{ isAnalog ? '⏺ Analog' : '○ Analog' }}</button>
      <button class="timeline-btn timeline-export" @click="exportTimeline">Export</button>
    </div>
    <div class="timeline-body">
      <div
        ref="tracksRef"
        class="timeline-tracks"
        :class="{ 'analog-mode': isAnalog }"
        @mousedown="onTrackMouseDown"
        @mousemove="onTrackMouseMove"
        @mouseup="onTrackMouseUp"
        @mouseleave="onTrackMouseUp"
      >
        <div
          v-for="(seg, i) in segments"
          :key="i"
          class="timeline-segment"
          :class="{ 'draggable': isAnalog }"
          :data-index="i"
          :style="{
            left: seg.leftPct + '%',
            width: seg.widthPct + '%',
            backgroundColor: seg.color,
            top: (i * 26) + 'px',
          }"
        >
          <span class="timeline-label">{{ seg.label }}</span>
        </div>
        <div
          class="timeline-playhead"
          :style="{ left: playheadPos + '%' }"
        />
      </div>
      <div class="timeline-controls">
        <div
          v-for="(seg, i) in segments"
          :key="i"
          class="timeline-control-row"
          :style="{ top: (i * 26) + 'px' }"
        >
          <span class="control-label" :style="{ color: seg.color }">{{ seg.label }}</span>
          <label>s<input type="number" step="0.05" :value="seg.start.toFixed(2)" @change="updateSegStart(i, $event)" /></label>
          <label>d<input type="number" step="0.05" :value="(seg.end - seg.start).toFixed(2)" @change="updateSegDur(i, $event)" /></label>
        </div>
      </div>
    </div>
    <pre v-if="exportedData" class="timeline-export-data">{{ exportedData }}</pre>
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

.timeline-debug {
  background: rgba(0, 0, 0, 0.9);
  border-top: 1px solid #333;
  padding: 16px 24px;
  font-family: monospace;
  font-size: 12px;
  color: #aaa;
}

.timeline-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.timeline-btn {
  background: #333;
  border: 1px solid #555;
  color: #fff;
  font-size: 16px;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.timeline-btn:hover {
  background: #444;
}

.timeline-time {
  font-size: 14px;
  color: #fff;
}

.timeline-tracks {
  position: relative;
  height: 360px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  flex: 1;
}

.timeline-segment {
  position: absolute;
  height: 20px;
  border-radius: 3px;
  opacity: 0.8;
  min-width: 3px;
}

.timeline-label {
  position: absolute;
  left: 4px;
  top: 2px;
  font-size: 11px;
  color: #fff;
  white-space: nowrap;
  line-height: 16px;
  font-weight: bold;
}

.timeline-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #ff3333;
  z-index: 10;
  pointer-events: none;
  box-shadow: 0 0 4px #ff3333;
}

.timeline-body {
  display: flex;
  gap: 16px;
}

.timeline-controls {
  position: relative;
  width: 240px;
  flex-shrink: 0;
  height: 360px;
}

.timeline-control-row {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 20px;
}

.control-label {
  font-size: 10px;
  width: 80px;
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
}

.timeline-control-row label {
  font-size: 9px;
  color: #888;
  display: flex;
  align-items: center;
  gap: 2px;
}

.timeline-control-row input {
  width: 50px;
  background: #222;
  border: 1px solid #444;
  color: #fff;
  font-family: monospace;
  font-size: 11px;
  padding: 1px 4px;
  border-radius: 2px;
}

.timeline-control-row input:focus {
  border-color: #888;
  outline: none;
}

.timeline-export {
  font-size: 11px !important;
  width: auto !important;
  padding: 4px 10px !important;
  margin-left: auto;
}

.timeline-analog-active {
  background: #a33 !important;
  border-color: #f55 !important;
}

.analog-mode {
  cursor: default;
}

.analog-mode .timeline-segment.draggable {
  cursor: grab;
}

.analog-mode .timeline-segment.draggable:active {
  cursor: grabbing;
}

.timeline-export-data {
  margin-top: 12px;
  background: #111;
  border: 1px solid #333;
  padding: 8px 12px;
  font-size: 11px;
  color: #adf;
  border-radius: 4px;
  max-height: 200px;
  overflow: auto;
  white-space: pre;
}
</style>
