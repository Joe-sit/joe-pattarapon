<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import Menu from '../assets/menu.svg'

const route = useRoute()
const isMenuOpen = ref(false)

const navLinks = [
  { label: 'Home',    to: '/',           name: 'HomePage' },
  { label: 'About',   to: '/about',      name: 'AboutPage' },
  { label: 'Works',   to: '/portfolio',  name: 'Portfolio' },
  { label: 'Sandbox', to: '/playground', name: 'Playground' },
]

function isActive(link) {
  return route.name === link.name
}
</script>

<template>
  <nav class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-16 py-6"
    style="height:80px; background: linear-gradient(180deg, rgba(255,244,223,0.5) 0%, rgba(255,255,255,0) 100%); backdrop-filter: blur(2px); -webkit-backdrop-filter: blur(2px);">

    <!-- Logo -->
    <router-link to="/" class="flex-shrink-0">
      <svg width="93" height="32" viewBox="-10 -10 259 104" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- J mask: cuts corner + hook -->
          <mask id="nav-j-mask">
            <rect x="-10" y="-10" width="259" height="104" fill="white"/>
            <path d="M41 55C36.5817 55 33 51.4183 33 47L33 30L49 30L49 47C49 51.4183 45.4183 55 41 55Z" fill="black"/>
            <rect x="-1" y="-1" width="35" height="32" fill="black"/>
          </mask>
          <!-- E mask: cuts counter + opening -->
          <mask id="nav-e-mask">
            <rect x="-10" y="-10" width="259" height="104" fill="white"/>
            <rect x="185" y="18" width="35" height="16" rx="8" fill="black"/>
            <path d="M185 57C185 52.5817 188.582 49 193 49H239V65H193C188.582 65 185 61.4183 185 57Z" fill="black"/>
          </mask>
        </defs>
        <!-- J -->
        <path d="M0 0H81V43.5C81 65.8675 62.8675 84 40.5 84V84C18.1325 84 0 65.8675 0 43.5V0Z" fill="#FD5000" mask="url(#nav-j-mask)"/>
        <!-- O petals -->
        <ellipse cx="117.717" cy="62.9484" rx="15.1684" ry="18.4624" transform="rotate(59.365 117.717 62.9484)" fill="#FD5000"/>
        <ellipse cx="126.342" cy="20.4592" rx="15.1684" ry="18.4624" transform="rotate(59.365 126.342 20.4592)" fill="#FD5000"/>
        <ellipse cx="99.732"  cy="41.2846" rx="14.1752" ry="19.4078" transform="rotate(28.5804 99.732 41.2846)" fill="#FD5000"/>
        <ellipse cx="144.851" cy="41.4516" rx="14.1752" ry="19.4078" transform="rotate(28.5804 144.851 41.4516)" fill="#FD5000"/>
        <!-- E -->
        <path d="M174 2H232V81H174V65H162V18H174Z" fill="#FD5000" mask="url(#nav-e-mask)"/>
        <rect x="231" y="10" width="8" height="29" fill="#FD5000"/>
      </svg>
    </router-link>

    <!-- Center nav links (desktop) -->
    <div class="hidden md:flex items-center" style="gap: 5px;">
      <router-link
        v-for="link in navLinks"
        :key="link.name"
        :to="link.to"
        class="flex items-center justify-center rounded-full text-sm font-medium transition-all duration-200"
        style="padding: 8px 16px; height: 34px; min-width: 80px;"
        :class="isActive(link)
          ? 'bg-[#FD5000] text-white'
          : 'hover:bg-black/5'"
        :style="isActive(link) ? '' : 'color: #292A2E;'"
      >
        {{ link.label }}
      </router-link>
    </div>

    <!-- Right: Resume + mobile hamburger -->
    <div class="flex items-center gap-3">
      <a
        href="https://drive.google.com/file/d/1wNLZ0a9ECBVrUdhQMQgO8cqppE5pFMcA/view?usp=sharing"
        target="_blank"
        class="hidden md:flex items-center justify-center rounded-full text-white text-sm font-medium hover:bg-[#e04800] transition-colors duration-200"
        style="padding: 8px 16px; width: 85px; height: 34px; background: #FD5000;"
      >
        Resume
      </a>

      <button
        @click="isMenuOpen = !isMenuOpen"
        class="md:hidden w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/5 transition-colors"
      >
        <Menu />
      </button>
    </div>

    <!-- Mobile dropdown -->
    <div
      v-if="isMenuOpen"
      class="absolute top-full left-0 right-0 mt-px bg-[#F1F0EE] border-b border-black/5 shadow-lg md:hidden"
    >
      <ul class="py-2 px-4 flex flex-col gap-1">
        <li v-for="link in navLinks" :key="link.name">
          <router-link
            :to="link.to"
            @click="isMenuOpen = false"
            class="block px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            :class="isActive(link) ? 'bg-[#FD5000] text-white' : 'text-black/60 hover:bg-black/5'"
          >
            {{ link.label }}
          </router-link>
        </li>
        <li>
          <a
            href="https://drive.google.com/file/d/1wNLZ0a9ECBVrUdhQMQgO8cqppE5pFMcA/view?usp=sharing"
            target="_blank"
            class="block px-4 py-2 rounded-xl text-sm font-medium text-[#FD5000]"
          >
            Resume
          </a>
        </li>
      </ul>
    </div>
  </nav>
</template>
