<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import Lenis from '@studio-freight/lenis'
import gsap from 'gsap'
import Flip from 'gsap/Flip'
import SplashScreen from './components/SplashScreen.vue'
import NavBar from './components/NavBar.vue'
import AnchorNav from './components/AnchorNav.vue'

gsap.registerPlugin(Flip)

const showSplash = ref(true)
const route = useRoute()

onMounted(() => {
  window.scrollTo(0, 0)

  const lenis = new Lenis({ duration: 1, smooth: true, resetNativeScroll: true })
  function raf(time) { lenis.raf(time); requestAnimationFrame(raf) }
  requestAnimationFrame(raf)
})
</script>

<template>
  <div class="bg-[#F1F0EE] min-h-screen">

    <!-- Splash Screen -->
    <SplashScreen v-if="showSplash" @done="showSplash = false" />

    <!-- Main Content -->
    <template v-else>
      <NavBar />

      <!-- Left anchor dots — only on homepage -->
      <AnchorNav v-if="route.name === 'HomePage'" />

      <!-- Bottom scroll fade -->
      <div class="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#F1F0EE] to-transparent pointer-events-none z-40" />

      <!-- Page content -->
      <div class="pt-[80px]">
        <router-view />

        <footer class="text-center w-full bg-[#F1F0EE] pb-16 mt-16">
          <div class="border-t border-black/10 px-6">
            <p class="text-sm text-black/30 mt-6">
              Designed & Built by Pattarapon Makhirun @2026 All Right Reserved.
            </p>
          </div>
        </footer>
      </div>
    </template>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Funnel+Display:wght@300..800&family=DM+Sans:wght@100..1000&family=Mitr:wght@200;300;400&display=swap');

html, body, * {
  font-family: 'Google Sans', 'DM Sans', sans-serif !important;
}

html, body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  background-color: #F1F0EE;
  cursor: none;
}

* {
  cursor: none !important;
}

@keyframes fade-in-up {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}
.fade-in-up { animation: fade-in-up 0.3s ease-in-out; }
</style>
