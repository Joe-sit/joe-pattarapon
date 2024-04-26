<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import LogoSVG from './assets/banner.svg'
import Menu from './assets/menu.svg'

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
    <nav class="flex w-full bg-white/5 backdrop-blur-[4px] sticky top-0">
      <div class="flex flex-col-2 justify-between mx-auto w-[1024px] my-5 relative">
        <a href="/" class="flex my-auto">
          <LogoSVG class="mx-6 mr-2" />
          <h1 class="text-white font-bold text-xl ">Joe Pattarapon</h1>
        </a>
        <button @click="toggleMenu" class="hamburger-button w-10 h-10 border border-[#ffffff]/50 rounded-xl
           border-[#B5B5B5] bg-[#1C1C1C] mx-6 transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a]
           focus:bg-[#3a3a3a] ">
          <Menu class="mx-auto" />
        </button>
        <div v-if="isMenuOpen" class="menu-box absolute top-full mx-6 right-0 mt-2 w-32 bg-[#272727] border-[.5px]
           border-[#B5B5B5] rounded-xl bg-opacity-100 fade-in-up">
          <ul class="text-white text-lg">
            <li><a href="/"
                class="block py-2 px-4 transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] rounded-xl">Home</a>
            </li>
            <li><a href="#"
                class="block py-2 px-4 transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] rounded-xl">About</a>
            </li>
            <li><a href="#" class="block py-2 px-4 hover:bg-[#2E2E2E] rounded-xl">
                <router-link :to="{ name: 'Portfolio' }">Portfolio</router-link>
              </a></li>
            <li><a href="#"
                class="block py-2 px-4 transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] rounded-xl">Resume</a>
            </li>
            <li><a href="#"
                class="block py-2 px-4 transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] rounded-xl">Transcript</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
    <router-view></router-view>
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
