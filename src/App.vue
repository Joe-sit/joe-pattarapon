<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import LogoSVG from './assets/joe-new-banner.svg'
import Menu from './assets/menu.svg'
import FooterSVG from './assets/Footer-JoeRebrand.svg'
import JoeSVG from './assets/joe-animated.svg'
import { useMotion } from '@vueuse/motion'
import Lenis from '@studio-freight/lenis'   // <-- Lenis import

const isMenuOpen = ref(false);
const showSplash = ref(true);
const router = useRouter();

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
}

onMounted(() => {
  window.scrollTo(0, 0);
  document.addEventListener('click', closeMenuOnClickOutside);

  // --- Lenis smooth scroll setup ---
  const lenis = new Lenis({
    duration: 1, // seconds
    // easing: t => 1 - Math.pow(1 - t, 3), // easeOutCubic
    smooth: true,
    resetNativeScroll: true,

  })

  function raf(time) {
    lenis.raf(time)
    requestAnimationFrame(raf)
  }

  requestAnimationFrame(raf)

  // Close menu when navigation occurs
  router.afterEach(() => {
    isMenuOpen.value = false;
  });

  // Hide splash screen after 6 seconds
  setTimeout(() => {
    showSplash.value = false;
  }, 6000);
});

const closeMenuOnClickOutside = (event) => {
  const menu = document.querySelector('.menu-box');
  const hamburgerButton = document.querySelector('.hamburger-button');
  if (menu && !menu.contains(event.target) && !hamburgerButton.contains(event.target)) {
    isMenuOpen.value = false;
  }
}
</script>

<template>
  <div class="bg-white">

    <!-- Splash Screen -->
    <div v-if="showSplash" class="splash-screen flex items-center justify-center fixed inset-0 bg-white z-[9999]">
      <JoeSVG class="animate-fade-in-out w-64 h-64" />
    </div>

    <!-- Main Content -->
    <div v-else>
      <nav class="flex mx-auto bg-white/5 backdrop-blur-[2px] sticky top-0 rounded-xl z-50">
        <div class="flex flex-col-2 justify-between mx-auto w-[1024px] my-6 relative">
          <a href="/" class="flex my-auto">
            <LogoSVG class="mx-6" />
          </a>
          <div class="hidden md:flex space-x-6 my-auto mx-6">
            <router-link to="/" class="text-black hover:text-orange-400"
              active-class="text-orange-500 font-bold">Home</router-link>
            <router-link to="/about" class="text-black hover:text-orange-400"
              active-class="text-orange-500 font-bold">About</router-link>
            <router-link to="/portfolio" class="text-black hover:text-orange-400"
              active-class="text-orange-500 font-bold">Works</router-link>
          </div>
          <a href="https://drive.google.com/file/d/1AL3EO8E9mwtoPQWW2I2QB8q-Oe1CYtB6/view?usp=sharing" target="_blank"
            class="hidden md:flex text-white transition-all duration-500 hover:-translate-y-0.5 px-4 py-1 bg-[#FD5000] rounded-full text-center items-center">
            Download Resume
          </a>
          <button @click="toggleMenu"
            class="hamburger-button w-10 h-10 transition-colors border rounded-xl mx-6 duration-500 ease-in-out hover:bg-[#3a3a3a] border-[#ffffff]/5 bg-[#1c1c1c] md:hidden">
            <Menu class="mx-auto" />
          </button>
          <div v-if="isMenuOpen"
            class="menu-box absolute top-full mx-6 right-0 mt-2 w-auto bg-[#ffffff] border-[.5px] border-[#ffffff]/5 rounded-xl bg-opacity-100 fade-in-up shadow-2xl">
            <ul class="text-black text-lg">
              <li>
                <router-link to="/"
                  class="block py-2 px-4 transition-colors duration-500 ease-in-out hover:bg-orange-100 hover:text-orange-600 rounded-xl"
                  active-class="text-orange-500 font-bold">Home</router-link>
              </li>
              <li>
                <router-link to="/about"
                  class="block py-2 px-4 transition-colors duration-500 ease-in-out hover:bg-orange-100 hover:text-orange-600 rounded-xl"
                  active-class="text-orange-500 font-bold">About</router-link>
              </li>
              <li>
                <router-link to="/portfolio"
                  class="block py-2 px-4 transition-colors duration-500 ease-in-out hover:bg-orange-100 hover:text-orange-600 rounded-xl"
                  active-class="text-orange-500 font-bold">Works</router-link>
              </li>
              <li>
                <a href="https://drive.google.com/file/d/1SgMjbau41IQnFTFTtOqEB5kRY4zNPF6E/view?usp=sharing"
                  target="_blank"
                  class="block py-2 px-4 transition-colors duration-500 ease-in-out hover:bg-orange-100 hover:text-orange-600 rounded-xl">Resume</a>
              </li>
              <li>
                <a href="https://drive.google.com/file/d/1BVSDuNsfsuXhzVb81vYbGIh2kcZ9mDRe/view?usp=sharing"
                  target="_blank"
                  class="block py-2 px-4 transition-colors duration-500 ease-in-out hover:bg-orange-100 hover:text-orange-600 rounded-xl">Transcript</a>
              </li>
              <li>
                <a href="https://drive.google.com/file/d/1SgMjbau41IQnFTFTtOqEB5kRY4zNPF6E/view?usp=sharing"
                  target="_blank"
                  class="block md:hidden py-2 px-4 transition-colors duration-500 ease-in-out hover:bg-orange-100 hover:text-orange-600 rounded-xl">
                  Download CV
                </a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <router-view></router-view>

      <footer class="text-white text-center w-full bg-white h-auto py-6">
        <div class="grid grid-row gap-y-2 border-t-[1px] border-[#B5B5B5] px-6">
          <h1 class="font-light text-sm sm:text-sm text-[#B5B5B5] mt-6">
            Designed & Built by Pattarapon Makhirun @2025 All Right Reserved.
          </h1>
        </div>
      </footer>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@100..1000&display=swap');

html,
body {
  font-family: 'DM Sans', sans-serif;
  margin: 0;
  padding: 0;
}

/* Splash animation */
@keyframes fade-in-out {
  0% { opacity: 0; }
  20% { opacity: 1; }
  80% { opacity: 1; }
  100% { opacity: 0; }
}

.animate-fade-in-out {
  animation: fade-in-out 6s ease-in-out forwards;
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
</style>
