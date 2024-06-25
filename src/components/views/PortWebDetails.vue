<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, } from 'vue-router';

import ekycImg from '../../assets/portfolios/first-portfolio-web.png'

import backSVG from '../../assets/arrow-left.svg'

import hiLightImg1 from '../../assets/portfolios/pf-1.jpg'
import hiLightImg2 from '../../assets/portfolios/pf-2.jpg'
import hiLightImg3 from '../../assets/portfolios/pf-3.jpg'
import hiLightImg4 from '../../assets/portfolios/pf-4.jpg'









import GoSVG from '../../assets/bubble.svg'
import figmaIcon from '../../assets/figma-icon.svg'
import photoshopIcon from '../../assets/photoshop-icon.svg'
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
        portId: 11,
        portName: 'Portfolio Website',
        category: 'Web Dev',
        imgSrc: ekycImg,
        subTitle: 'Web Technology Project 2020',
        hiLightImg1: hiLightImg1,
        hiLightImg2: hiLightImg2,
        hiLightImg3: hiLightImg3,
        hiLightImg4: hiLightImg4,


    }
])

const portName = ref(data.value[0].portName)
const subTitle = ref(data.value[0].subTitle)
const imgSrc = ref(data.value[0].imgSrc)
const hiImg1 = ref(data.value[0].hiLightImg1)
const hiImg2 = ref(data.value[0].hiLightImg2)
const hiImg3 = ref(data.value[0].hiLightImg3)
const hiImg4 = ref(data.value[0].hiLightImg4)






const router = useRouter();

const goToPortfolioPage = () => {
    router.push({ name: 'Portfolio' });
}

const goToAppMan = () => {
    window.open('https://github.com/Joe-sit/INT102-PORTFOLIO-WEB', '_blank')
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
                    border border-[#ffffff]/5 rounded-xl ">

                    <h1 class="text-[#8A949C] text-base font-medium mt-6 mx-6 ">Overview</h1>
                    <p class="text-[#F2F2F2] text-xl sm:text-lg mt-4 mx-6 break-words font-light  ">
                        This portfolio website was created using HTML and CSS.
                        This website includes sections about myself, education, previous work, and my future career
                        interests.
                    </p>

                    <div class="flex justify-end mx-6 mb-6 mt-4">
                        <a href="https://joe-sit.github.io/INT102-PORTFOLIO-WEB/" target="_blank" class="flex text-white bg-[#141414] my-2 rounded-xl px-3 py-3 
                            transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F] border border-[#ffffff]/5">
                            Check the website
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
                            <div class="flex items-center px-3 py-2  border border-[#ffffff]/5 rounded-full">
                                <span class="inline-block align-middle mr-2">
                                    <photoshopIcon class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-base sm:text-sm text-white whitespace-nowrap">Photoshop</span>
                            </div>

                            <div class="flex items-center px-3 py-2  border border-[#ffffff]/5 rounded-full">
                                <span class="inline-block align-middle mr-2">
                                    <vscodeIcon class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-base sm:text-sm text-white whitespace-nowrap">Visual Studio
                                    Code</span>
                            </div>


                        </div>


                    </div>

                    <div class="mt-6">
                        <!-- More/Method -->
                        <h1 class="text-[#8A949C] text-base font-medium  mx-4 ">More</h1>
                        <div @click="goToAppMan()" class="w-full mt-4 mx-4 mb-6 ">
                            <div class=" flex flex-wrap gap-2">
                                <div class="flex items-center px-3 py-2 cursor-pointer transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]
                                  border border-[#ffffff]/5 rounded-full">
                                    <span class="inline-block align-middle mr-2">
                                        <externalIcon class="h-6 w-6 fill-white" />
                                    </span>
                                    <span class="text-base sm:text-sm text-white whitespace-nowrap">GitHub</span>
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
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Project Scope</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">This is and individual project for Web
                        Technology course. The project outcome is to build a simple portfolio website by using only HTML
                        and CSS without any other frameworks.</p>

                    <!--Pagination-->

                    <swiper class=" text-white w-auto mt-6 mb-6 rounded-3xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="hiImg1" alt="project image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="hiImg2" alt="problem image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="hiImg3" alt="problem image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="hiImg4" alt="problem image" class="w-auto" /></swiper-slide>


                    </swiper>

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">This website consists of 6 sections

                        <span class="ml-4 mt-4 block">• About: A brief explanation about myself.</span>
                        <span class="ml-4 mt-4 block">• Education: Details about my educational background.</span>
                        <span class="ml-4 mt-4 block">• Skills: Overview of my skills and abilities.</span>
                        <span class="ml-4 mt-4 block">• Projects: Highlights of previous works or projects.</span>
                        <span class="ml-4 mt-4 block">• Interests: Things I am interested in or passionate about.</span>
                        <span class="ml-4 mt-4 block">• Contact: Ways to get in touch with me.</span>
                        <span class="mt-4 block">Additionally, there is a Tags and Rules References page that explains
                            the usage of HTML tags and CSS properties.</span>
                    </p>

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