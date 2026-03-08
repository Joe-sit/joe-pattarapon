<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import Menu from './assets/menu.svg'
import JoeLogo from './assets/JoeRebrand.svg'
import Lenis from '@studio-freight/lenis'
import gsap from 'gsap'
import Flip from 'gsap/Flip'
// import SplashScreen from './components/SplashScreen.vue'
import JoeSVG from './components/JoeSVG.vue'

gsap.registerPlugin(Flip)

const isMenuOpen = ref(false)
const showSplash = ref(true)
const isScrolled = ref(false)
const router = useRouter()

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value
}

const closeMenuOnClickOutside = (event) => {
  const menu = document.querySelector('.menu-box')
  const hamburgerButton = document.querySelector('.hamburger-button')
  if (menu && !menu.contains(event.target) && !hamburgerButton.contains(event.target)) {
    isMenuOpen.value = false
  }
}

onMounted(() => {
  window.scrollTo(0, 0)
  document.addEventListener('click', closeMenuOnClickOutside)

  window.addEventListener('scroll', () => {
    isScrolled.value = window.scrollY > 10
  })

  const lenis = new Lenis({
    duration: 1,
    smooth: true,
    resetNativeScroll: true
  })

  function raf(time) {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }

  requestAnimationFrame(raf)

  router.afterEach(() => {
    isMenuOpen.value = false
  })

  setTimeout(() => {
    showSplash.value = false
  }, 4000)
})
</script>

<template>
  <div class="bg-gray-50">

    <!-- Splash Screen -->
    <!-- <SplashScreen v-if="showSplash" /> -->
    <div v-if="showSplash" class="splash-screen flex items-center justify-center fixed inset-0 bg-gray-50 z-[9999]">
      <JoeSVG />
    </div>

    <!-- Main Content -->
    <div v-else>
      <!-- Navigation -->
      <nav
          :class="['fixed top-6 left-1/2 -translate-x-1/2 z-50 nav-enter flex items-center gap-1 bg-white/60 border border-black/10 rounded-full px-2 py-1.5 transition-shadow duration-300', isScrolled ? 'shadow-lg' : 'shadow-sm']"
          style="backdrop-filter: saturate(80%) blur(60px); -webkit-backdrop-filter: saturate(80%) blur(60px);">
          <!-- Avatar + Name -->
          <div class="flex items-center gap-2 px-2">

            <JoeLogo />

            <span class="text-sm font-semibold text-black hidden md:block whitespace-nowrap">Joe.</span>
          </div>

          <!-- Divider -->
          <div class="w-px h-4 bg-black/10 mx-1 hidden md:block"></div>

          <!-- Nav Links -->
          <div class="hidden md:flex items-center gap-0.5">
            <router-link to="/"
              class="px-3 py-1.5 rounded-full text-sm font-medium text-black/60 hover:text-black hover:bg-black/5 transition-all duration-200"
              exact-active-class="!text-[#FD5000] font-semibold bg-[#FD5000]/10">Home</router-link>
            <router-link to="/portfolio"
              class="px-3 py-1.5 rounded-full text-sm font-medium text-black/60 hover:text-black hover:bg-black/5 transition-all duration-200"
              exact-active-class="!text-[#FD5000] font-semibold bg-[#FD5000]/10">Work</router-link>
            <router-link to="/about"
              class="px-3 py-1.5 rounded-full text-sm font-medium text-black/60 hover:text-black hover:bg-black/5 transition-all duration-200"
              exact-active-class="!text-[#FD5000] font-semibold bg-[#FD5000]/10">About</router-link>
          </div>

          <!-- Resume Button -->
          <a href="https://drive.google.com/file/d/1AL3EO8E9mwtoPQWW2I2QB8q-Oe1CYtB6/view?usp=sharing" target="_blank"
            class="hidden md:flex px-4 py-1.5 rounded-full text-sm font-medium bg-[#FD5000] text-white hover:bg-[#e04800] transition-all duration-200 ml-1">
            Resume
          </a>

          <!-- Mobile Hamburger -->
          <button @click="toggleMenu"
            class="hamburger-button w-8 h-8 flex items-center justify-center rounded-full md:hidden hover:bg-black/5 transition-colors duration-200">
            <Menu />
          </button>

          <!-- Mobile Dropdown -->
          <div v-if="isMenuOpen"
            class="menu-box absolute top-full left-0 right-0 mt-2 bg-white border border-black/10 rounded-2xl shadow-xl fade-in-up overflow-hidden">
            <ul class="text-black py-1">
              <li>
                <router-link to="/" class="block py-2 px-4 text-sm hover:bg-black/5 transition-colors"
                  active-class="font-semibold">Home</router-link>
              </li>
              <li>
                <router-link to="/portfolio" class="block py-2 px-4 text-sm hover:bg-black/5 transition-colors"
                  active-class="font-semibold">Work</router-link>
              </li>
              <li>
                <router-link to="/about" class="block py-2 px-4 text-sm hover:bg-black/5 transition-colors"
                  active-class="font-semibold">About</router-link>
              </li>
              <li>
                <a href="https://drive.google.com/file/d/1SgMjbau41IQnFTFTtOqEB5kRY4zNPF6E/view?usp=sharing"
                  target="_blank" class="block py-2 px-4 text-sm hover:bg-black/5 transition-colors">Resume</a>
              </li>
            </ul>
          </div>
      </nav>



      <!-- Bottom Scroll Fade -->
      <div class="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-gray-50 to-transparent pointer-events-none z-40"></div>

      <!-- Router Content -->
      <div class="pt-24">
        <router-view></router-view>

        <!-- Footer -->
        <footer class="text-white text-center w-full bg-gray-50 h-auto pt-0 pb-16">
          <div class="h-16 bg-gradient-to-b from-transparent to-gray-50 -mt-16 pointer-events-none"></div>
          <div class="grid grid-row gap-y-2 border-t-[1px] border-[#B5B5B5] px-6">
            <h1 class="font-light text-sm sm:text-sm text-[#B5B5B5] mt-6">
              Designed & Built by Pattarapon Makhirun @2026 All Right Reserved.
            </h1>
          </div>
        </footer>
      </div>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&family=DM+Sans:wght@100..1000&family=Mitr:wght@200;300;400&display=swap');

/* ✅ FIX: Override Tailwind's preflight font with !important */
html,
body,
* {
  font-family: 'Funnel Display', sans-serif !important;
}

html,
body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  background-color: #f9fafb;
}

/* Splash screen */
.splash-screen {
  animation: splash-fade-out 0.6s ease-in-out 3.4s forwards;
}

@keyframes splash-fade-out {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
  }
}


/* Menu animation */
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in-up {
  animation: fade-in-up 0.3s ease-in-out;
}

/* Nav enter animation */
.nav-enter {
  animation: nav-slide-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes nav-slide-in {
  from {
    opacity: 0;
    transform: translateX(-50%) translateY(-20px);
  }

  to {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
}
</style>