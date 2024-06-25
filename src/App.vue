<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import LogoSVG from './assets/JoeRebrand.svg'
import Menu from './assets/menu.svg'
import FooterSVG from './assets/Footer-JoeRebrand.svg'

const isMenuOpen = ref(false);
const router = useRouter();

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
}

onMounted(() => {
  window.scrollTo(0, 0);
  document.addEventListener('click', closeMenuOnClickOutside);
  // Close menu when navigation occurs
  router.afterEach(() => {
    isMenuOpen.value = false;
  });
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
  <div class="">
    <nav class="flex mx-auto bg-white/5 backdrop-blur-[4px] sticky top-0 rounded-xl">
      <div class="flex flex-col-2 justify-between mx-auto w-[1024px] my-5 relative">
        <a href="/" class="flex my-auto">
          <LogoSVG class="mx-6 mr-4" />
          <h1 class="bg-gradient-to-r from-slate-50 to-zinc-400 bg-clip-text text-transparent font-bold text-2xl">Joe Pattarapon</h1>
        </a>
        <div class="hidden md:flex space-x-6 my-auto mx-4">
          <router-link to="/" class="text-white hover:text-gray-400" active-class="font-bold">Home</router-link>
          <router-link to="/" class="text-white opacity-50 cursor-not-allowed">About</router-link>
          <router-link to="/portfolio" class="text-white hover:text-gray-400" active-class="font-bold">Works</router-link>
          <router-link to="/" class="text-white opacity-50 cursor-not-allowed">Resume</router-link>
          <a href="https://drive.google.com/file/d/1Y050T_mqrkQ86p7JJax8Cx5qH5_pwRsB/view?usp=sharing" target="_blank" class="text-white hover:text-gray-400">Transcript</a>
        </div>
        <button @click="toggleMenu" class="hamburger-button w-10 h-10 transition-colors border rounded-xl mx-6 duration-300 ease-in-out hover:bg-[#3a3a3a] border-[#ffffff]/5 bg-[#141414] md:hidden">
          <Menu class="mx-auto" />
        </button>
        <div v-if="isMenuOpen" class="menu-box absolute top-full mx-6 right-0 mt-2 w-auto bg-[#141414] border-[.5px] border-[#ffffff]/5 rounded-xl bg-opacity-100 fade-in-up shadow-2xl">
          <ul class="text-white text-lg">
            <li>
              <router-link to="/" class="block py-2 px-4 transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] rounded-xl" active-class="font-bold">Home</router-link>
            </li>
            <li>
              <a class="cursor-not-allowed opacity-50 block py-2 px-4 transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] rounded-xl">About (Coming soon)</a>
            </li>
            <li>
              <router-link to="/portfolio" class="block py-2 px-4 transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] rounded-xl" active-class="font-bold">Works</router-link>
            </li>
            <li>
              <a class="cursor-not-allowed opacity-50 block py-2 px-4 transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] rounded-xl">Resume (Coming soon)</a>
            </li>
            <li>
              <a href="https://drive.google.com/file/d/1Y050T_mqrkQ86p7JJax8Cx5qH5_pwRsB/view?usp=sharing" target="_blank" class="block py-2 px-4 transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] rounded-xl">Transcript</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    <router-view></router-view>
    <footer class="text-white text-center w-full bg-white/5 h-auto py-6">
      <div class="grid grid-row gap-y-2">
        <FooterSVG class="mx-auto inline-block" />
        <h1 class="font-light">@2024 All Right Reserved</h1>
        <h1 class="font-light">Built & Designed by Pattarapon Makhirun</h1>
      </div>
    </footer>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');

html,
body {
  font-family: 'DM Sans', sans-serif;
}

body {
  background-color: #141414;
}

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

/* Apply fade-in-up animation to elements with the .fade-in-up class */
.fade-in-up {
  animation: fade-in-up 0.5s ease-in-out;
}

/* Showcase image animation */
.image-container {
  overflow: hidden;
  /* Hide any overflow from the scaled image */
  border-radius: inherit;
  /* Preserve the rounded corners of the parent container */
}

.showcase-image {
  transition: transform 0.3s ease;
}

.image-container:hover .showcase-image {
  transform: scale(1.1);
  /* Scale up by 10% on hover */
}

.menu-box {
  transition: transform 0.1s ease-in-out;
}
</style>
