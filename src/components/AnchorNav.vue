<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const sections = [
  { id: 'hero',    label: 'Intro' },
  { id: 'works',   label: 'Works' },
  { id: 'impact',  label: 'Impact' },
  { id: 'about',   label: 'About' },
  { id: 'contact', label: 'Contact' },
]

const DOT = 16
const STEP = DOT + 24 // 40px per slot

const pillTop = ref(0)
const pillHeight = ref(DOT)
const activeIndex = ref(0)

function getSectionTops() {
  return sections.map(s => {
    const el = document.getElementById(s.id)
    return el ? el.getBoundingClientRect().top + window.scrollY : Infinity
  })
}

function onScroll() {
  if (window.scrollY <= 0) {
    pillTop.value = 0
    pillHeight.value = DOT
    activeIndex.value = 0
    return
  }

  const tops = getSectionTops()
  const trigger = window.scrollY + window.innerHeight * 0.4

  let i = 0
  for (let j = 0; j < sections.length - 1; j++) {
    if (trigger >= tops[j] && trigger < tops[j + 1]) {
      i = j
      const frac = (trigger - tops[j]) / (tops[j + 1] - tops[j])
      const easedFrac = frac * frac * (3 - 2 * frac) // smoothstep
      pillTop.value = i * STEP
      pillHeight.value = DOT + easedFrac * STEP
      activeIndex.value = Math.round(i + frac)
      return
    }
  }

  // Past last known section
  const last = sections.length - 1
  pillTop.value = last * STEP
  pillHeight.value = DOT
  activeIndex.value = last
}

function scrollTo(id) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  onScroll()
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div
    class="fixed z-40 hidden lg:block bg-white rounded-[100px]"
    style="left: 64px; top: 50%; transform: translateY(-50%); width: 32px; padding: 8px; box-shadow: 0px 4px 24px rgba(219,219,219,0.12);"
  >
    <!-- Static dots -->
    <div class="relative flex flex-col" style="gap: 24px; width: 16px;">
      <button
        v-for="(s, i) in sections"
        :key="s.id"
        @click="scrollTo(s.id)"
        class="group relative flex items-center justify-center flex-shrink-0"
        style="width:16px; height:16px;"
        :aria-label="s.label"
      >
        <span class="block rounded-full" style="width:16px;height:16px;background:#D9D9D9;" />
        <!-- Tooltip -->
        <span
          class="absolute whitespace-nowrap text-xs font-medium pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
          style="left: calc(100% + 10px); top: 50%; transform: translateY(-50%);"
          :style="{ color: activeIndex === i ? '#FD5000' : '#292A2E' }"
        >{{ s.label }}</span>
      </button>

      <!-- Floating pill — raw inline style, no CSS transition -->
      <div
        class="absolute rounded-[100px] pointer-events-none"
        :style="{ top: pillTop + 'px', height: pillHeight + 'px', width: '16px', background: '#FD5000', transition: 'height 0.15s ease-out, top 0.15s ease-out' }"
      />
    </div>
  </div>
</template>
