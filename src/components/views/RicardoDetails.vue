<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, } from 'vue-router';

import ekycImg from '../../assets/portfolios/ricardo-game.png'

import backSVG from '../../assets/arrow-left.svg'

import hiLightImg1 from '../../assets/portfolios/r-1.jpg'
import hiLightImg2 from '../../assets/portfolios/r-2.jpg'
import hiLightImg3 from '../../assets/portfolios/r-3.jpg'









import GoSVG from '../../assets/bubble.svg'
import scratchIcon from '../../assets/scratch-icon.svg'
import vscodeIcon from '../../assets/vs-code.svg'
import externalIcon from '../../assets/external-site.svg'










import { Swiper, SwiperSlide } from 'swiper/vue';
import { Pagination, Navigation } from 'swiper/modules'


// import { EffectCube } from "swiper/vue"


import 'swiper/swiper-bundle.css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

// import "swiper/css/effect-cube"

const data = ref([
    {
        portId: 12,
        portName: 'Ricardo Your Hero',
        category: 'Other',
        imgSrc: ekycImg,
        subTitle: 'Scratch Game Dev 2019',
        hiLightImg1: hiLightImg1,
        hiLightImg2: hiLightImg2,
        hiLightImg3: hiLightImg3,


    }
])

const portName = ref(data.value[0].portName)
const subTitle = ref(data.value[0].subTitle)
const imgSrc = ref(data.value[0].imgSrc)
const hiImg1 = ref(data.value[0].hiLightImg1)
const hiImg2 = ref(data.value[0].hiLightImg2)
const hiImg3 = ref(data.value[0].hiLightImg3)






const router = useRouter();

const goToPortfolioPage = () => {
    router.push({ name: 'Portfolio' });
}

const goToAppMan = () => {
    window.open('https://www.youtube.com/watch?v=QXru0rSV2ZQ', '_blank')
}




console.log(subTitle.value);

</script>

<template>
    <div>
        <backSVG @click="goToPortfolioPage" class="cursor-pointer mb-4" />
        <!--Title-->
        <h1 class="flex mx-auto font-bold text-4xl sm:text-3xl text-[#F2F2F2]">
            {{ portName }}
        </h1>
        <!--Sub Title-->
        <p class="text-[#8A949C] mt-2 text-2xl sm:text-xl">{{ subTitle }}</p>

        <div>



            <!--Project banner-->
            <img :src="imgSrc" alt="project image" class="w-auto mt-10 mb-6">






           <!--Project Overview section-->
<div class="w-full grid grid-cols-12 gap-4 mt-6">

<!-- Overview -->
<div class="col-span-12 md:col-span-8 bg-[#101010] 
    border border-[#ffffff]/5 rounded-xl flex flex-col justify-between"> <!-- Added flex, flex-col, and justify-between -->

    <div> <!-- Wrapped the content in an additional div -->
        <h1 class="text-[#8A949C] text-base font-medium mt-6 mx-6 ">Overview</h1>
        <p class="text-[#F2F2F2] text-xl sm:text-lg mt-4 mx-6 break-words font-light  ">
            Ricardo Your Hero is a survival shooting game created using Scratch programming.
        </p>
    </div>

    <div class="flex justify-end mx-6 mb-6 mt-4">
        <a href="https://scratch.mit.edu/projects/315471743" target="_blank" class="flex text-white bg-[#141414] my-2 rounded-xl px-3 py-3 
            transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F] border border-[#ffffff]/5">
            Try playing
            <GoSVG class="ml-2 inline-block fill-white w-6 h-6" viewBox="0 0 40 40" />
        </a>
    </div>
</div>

<!-- Right column -->
<div class="col-span-12 md:col-span-4 bg-[#101010] mt-2 sm:mt-0
    border border-[#ffffff]/5 rounded-xl px-2 py-2 ">

    <!-- Tools -->
    <h1 class="text-[#8A949C] text-base font-medium mt-4 mx-4 ">Tools</h1>
    <div class="w-full mt-4 mx-4">
        <div class=" flex flex-wrap gap-2">
            <div class="flex items-center px-3 py-2 border border-[#ffffff]/5 rounded-full">
                <span class="inline-block align-middle mr-2">
                    <scratchIcon class="h-6 w-6 fill-white" />
                </span>
                <span class="text-base sm:text-sm text-white whitespace-nowrap">Scratch</span>
            </div>
        </div>
    </div>

    <div class="mt-6">
        <!-- More/Method -->
        <h1 class="text-[#8A949C] text-base font-medium mx-4 ">Reference</h1>
        <div @click="goToAppMan()" class="w-full mt-4 mx-4 mb-6">
            <div class=" flex flex-wrap gap-2">
                <div class="flex items-center px-3 py-2 cursor-pointer transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]
                  border border-[#ffffff]/5 rounded-full">
                    <span class="inline-block align-middle mr-2">
                        <externalIcon class="h-6 w-6 fill-white" />
                    </span>
                    <span class="text-base sm:text-sm text-white whitespace-nowrap">Fuelvin</span>
                    <GoSVG class="ml-2 inline-block fill-white w-6 h-6" viewBox="0 0 40 40" />
                </div>
            </div>
        </div>
    </div>
</div>
</div>


            <!--Description-->

            <div>

                <!--Product Overview-->
                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Instructions</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">1. How to Play Ricardo Your Hero
                        <span class="ml-4 mt-4 block">• Movement: Use the W, A, S, D keys to walk.</span>
                        <span class="ml-4 mt-4 block">• Aiming: Aim using your mouse pointer.</span>
                        <span class="mt-4 block">2. Important Tips
                            <span class="ml-4 mt-4 block">• Avoid Misclicks: Do not click on the gameplay screen, as
                                this will accidentally purchase an upgrade.</span>
                            <span class="ml-4 mt-4 block">• Freeze Upgrade:</span>
                            <span class="ml-6 mt-4 block">• Purchase the Freeze upgrade 10 times to activate it.</span>
                            <span class="ml-6 mt-4 block">• Once activated, it will freeze zombies (excluding the boss
                                zombie, though it will still take damage).</span>
                            <span class="ml-6 mt-4 block">• All frozen zombies will be instantly killed after the effect
                                wears off.</span>


                        </span>
                        <span class="mt-4 block">3. Enjoy the game!</span>
                    </p>

                    <!--Pagination-->

                    <swiper class=" text-white w-auto mt-6 mb-6 rounded-3xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="hiImg1" alt="project image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="hiImg2" alt="problem image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="hiImg3" alt="problem image" class="w-auto" /></swiper-slide>


                    </swiper>

                   

                </div>




















                <!--Go next-->
                <div class="mt-10">
                    <h1 class="text-white text-2xl sm:text-xl font-medium mb-6">Where should I go next?</h1>
                    <router-link :to="{ name: 'Portfolio' }"
                        class="text-[#2F80ED] text-lg sm:text-base font-light hover:underline ">
                        Explore all of my projects
                    </router-link>
                </div>
            </div>
        </div>
    </div>
</template>


<style>
.swiper-button-next {}

.swiper-pagination-fraction {
    background-color: rgba(0, 0, 0, 0.5);
    width: auto;
    margin: 0 auto;
    position: absolute;
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 5px 10px;
    border-radius: 5px;
}
</style>