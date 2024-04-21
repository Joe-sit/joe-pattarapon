<script setup>
import { ref, onMounted } from 'vue'
import LogoSVG from './assets/banner.svg'
import Menu from './assets/menu.svg'
import HomePageVue from './components/HomePage.vue'

const isMenuOpen = ref(false);

const toggleMenu = () => {
  isMenuOpen.value = !isMenuOpen.value;
}

onMounted(() => {
  document.addEventListener('click', closeMenuOnClickOutside);
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
    <nav class="flex w-full h-auto bg-white/5 backdrop-blur-sm sticky top-0">
      <!--Header-->
      <div class="flex flex-col-2 justify-between mx-auto w-[1024px] my-5 relative">
        <a href="" class="flex my-auto">
          <LogoSVG class="mx-6 mr-2" />
          <h1 class="text-white font-bold text-xl">Joe Pattarapon</h1>
        </a>
        <!--Hamburger-->
        <button @click="toggleMenu"
          class="hamburger-button w-10 h-10 border-[.5px] rounded-xl border-[#B5B5B5] bg-[#1C1C1C] mx-6 ">
          <Menu class="mx-auto" />
        </button>
        <!-- Menu -->
        <div v-if="isMenuOpen"
          class="menu-box absolute top-full mx-6 right-0 mt-2 w-32 bg-[#272727] border-[.5px] border-[#B5B5B5] rounded-xl bg-opacity-100">
          <ul class="text-white text-lg">
            <li><a href="#" class="block py-2 px-4 hover:bg-[#2E2E2E] rounded-xl">Home</a></li>
            <li><a href="#" class="block py-2 px-4 hover:bg-[#2E2E2E] rounded-xl">About</a></li>
            <li><a href="#" class="block py-2 px-4 hover:bg-[#2E2E2E] rounded-xl">Portfolio</a></li>
            <li><a href="#" class="block py-2 px-4 hover:bg-[#2E2E2E] rounded-xl">Resume</a></li>
            <li><a href="#" class="block py-2 px-4 hover:bg-[#2E2E2E] rounded-xl">Transcript</a></li>
          </ul>
        </div>
      </div>
    </nav>

    <div class="mx-auto max-w-screen-lg h-screen">


      <div class="w-full ">
        <div class="mx-6 my-6 bg-[#272727] border-[.5px] border-[#B5B5B5] rounded-xl">
          <div class="my-10 mx-6">
            <h1 class="text-white text-4xl mb-6">
              <span class="">Hi, I’m </span><span class="font-medium">Joe Pattarapon</span>
            </h1>
            <h1 class="">
              <p class="text-2xl text-[#E9EAEB] break-words">Passionate about design and enjoy making ideas for better
                solution.
                Passionate about design and enjoy making ideas for better solution.</p>
            </h1>
          </div>
        </div>
      </div>

      <!--About Section---->
      <div class="">
        <div class="grid grid-cols-12 gap-6 mx-6 b">
          <!-- Column -->
          <div class="col-span-12 md:col-span-4">
            <img src="./assets/me-white-bg.png" class=" object-cover object-center ">
          </div>
          <!-- Column -->
          <div class="col-span-12 md:col-span-8 bg-[#272727] border-[.5px] border-[#B5B5B5] rounded-xl w-full">
            <h1 class="font-medium text-lg text-[#8A949C] mx-6 mt-6">ABOUT</h1>
            <p class="mt-4 font-medium mx-6 text-2xl text-white break-words">
              Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the
              industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and
              scrambled it to make a type specimen book.
            </p>
            <button class="text-white border my-4 rounded-xl px-4 py-4 justify-end mx-6 ">Read more</button>
          </div>

        </div>
      </div>


    </div>

  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');

html,
body {
  font-family: 'DM Sans', sans-serif;
}

body {
  background-color: #1C1C1C;
}
</style>
