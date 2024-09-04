<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import LogoSVG from './assets/joe-new-banner.svg'
import Menu from './assets/menu.svg'
import FooterSVG from './assets/Footer-JoeRebrand.svg'
import { useMotion } from '@vueuse/motion'

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
  <div class="bg-white">
    

    <nav class=" flex mx-auto bg-white/5 backdrop-blur-[2px] sticky top-0 rounded-xl z-50">
      <div class="flex flex-col-2 justify-between mx-auto w-[1024px] my-6 relative">
        <a href="/" class="flex my-auto">
          <LogoSVG class="mx-6" />
          <!-- <h1 class="bg-gradient-to-r from-slate-50 to-zinc-400 bg-clip-text text-transparent font-bold text-2xl">Joe Pattarapon</h1> -->
        </a>
        <div class="hidden md:flex space-x-6 my-auto mx-6">
          <router-link to="/" class="text-black hover:text-orange-400 "
            active-class="text-orange-500 font-bold">Home</router-link>
          <router-link to="/about" class="text-black hover:text-orange-400"
            active-class="text-orange-500 font-bold">About</router-link>
          <router-link to="/portfolio" class="text-black hover:text-orange-400"
            active-class="text-orange-500 font-bold">Works</router-link>
          <!-- <a href="https://drive.google.com/file/d/1BVSDuNsfsuXhzVb81vYbGIh2kcZ9mDRe/view?usp=sharing" target="_blank" class="text-black hover:text-orange-400">Transcript</a> -->
        </div>
        <a href="https://drive.google.com/file/d/1P7nafOesRX49pHXvN_QVr-MPoe0n4xEj/view?usp=sharing" target="_blank"
          class="hidden md:flex text-white transition-all duration-500 hover:-translate-y-0.5 px-4 py-1 bg-[#FD5000] rounded-full text-center items-center">Download
          Resume</a>
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
                active-class="text-orange-500 font-bold">
                About
              </router-link>
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
            <!-- Download CV button added here for small screens -->
            <li>
              <a href="https://drive.google.com/file/d/1SgMjbau41IQnFTFTtOqEB5kRY4zNPF6E/view?usp=sharing"
                target="_blank"
                class="block md:hidden py-2 px-4 transition-colors duration-500 ease-in-out hover:bg-orange-100 hover:text-orange-600 rounded-xl ">Download
                CV</a>
            </li>
          </ul>
        </div>
      </div>
    </nav>

    <router-view></router-view>
    <footer class="text-white text-center w-full bg-white h-auto py-6">
      <div class="grid grid-row gap-y-2 border-t-[1px] border-[#B5B5B5] px-6">
        <!-- <FooterSVG class="mx-auto inline-block" /> -->
        <h1 class="font-light text-sm sm:text-sm text-[#B5B5B5] mt-6">Designed & Built by Pattarapon Makhirun @2024 All
          Right Reserved.</h1>
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


@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
    animation-duration: 6000ms;
  }

  to {
    opacity: 1;
    transform: translateY(0);

  }
}

/* Apply fade-in-up animation to elements with the .fade-in-up class */
.fade-in-up {
  animation: fade-in-up 6000ms ease-in-out;
}

/* Showcase image animation */
.image-container {
  overflow: hidden;
  /* Hide any overflow from the scaled image */
  border-radius: inherit;
  /* Preserve the rounded corners of the parent container */
}

.showcase-image {
  transition: transform 5s ease;
}

.image-container:hover .showcase-image {
  transform: scale(1.1);
  /* Scale up by 10% on hover */
}

.menu-box {
  transition: transform 5s ease-in-out;
}
</style>
