<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, } from 'vue-router';

import waterMapImg from '../../assets/portfolios/water-map.png'
import externalSVG from '../../assets/arrow-square-out.svg'
import backSVG from '../../assets/arrow-left.svg'
import problemStateImg from '../../assets/portfolios/water-map-problem.jpg'
import structureImg from '../../assets/portfolios/water-map-structure.png'
import empathyMapImg1 from '../../assets/portfolios/water-map-emp-1.jpg'
import empathyMapImg2 from '../../assets/portfolios/water-map-emp-2.jpg'


import ideateImg1 from '../../assets/portfolios/water-map-ideate-1.jpg'
import ideateImg2 from '../../assets/portfolios/water-map-ideate-2.jpg'
import ideateImg3 from '../../assets/portfolios/water-map-ideate-3.jpg'

import lofiWiImg1 from '../../assets/portfolios/water-map-lofi-1.jpg'
import lofiWiImg2 from '../../assets/portfolios/water-map-lofi-2.jpg'
import lofiWiImg3 from '../../assets/portfolios/water-map-lofi-3.jpg'
import lofiWiImg4 from '../../assets/portfolios/water-map-lofi-4.jpg'
import lofiWiImg5 from '../../assets/portfolios/water-map-lofi-5.jpg'



import GoSVG from '../../assets/bubble.svg'
import figmaIcon from '../../assets/figma-icon.svg'
import lightIcon from '../../assets/light-blub-icon.svg'



import { Swiper, SwiperSlide } from 'swiper/vue';
import { Pagination, Navigation } from 'swiper/modules'


// import { EffectCube } from "swiper/vue"


import 'swiper/swiper-bundle.css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

// import "swiper/css/effect-cube"

const data = ref([
    {
        portId: 10,
        portName: 'WaterMap',
        category: 'UX/UI',
        imgSrc: waterMapImg,
        subTitle: 'User Experience Design Project 2020',
        problemStateImg: problemStateImg,
        structureImg: structureImg,
        ideateImg1: ideateImg1,
        ideateImg2: ideateImg2,
        ideateImg3: ideateImg3,
        empathyMapImg1: empathyMapImg1,
        empathyMapImg2: empathyMapImg2,
        lofiWiImg1: lofiWiImg1,
        lofiWiImg2: lofiWiImg2,
        lofiWiImg3: lofiWiImg3,
        lofiWiImg4: lofiWiImg4,
        lofiWiImg5: lofiWiImg5
    }
])

const portName = ref(data.value[0].portName)
const subTitle = ref(data.value[0].subTitle)
const imgSrc = ref(data.value[0].imgSrc)
const problemImg = ref(data.value[0].problemStateImg)
const strucImg = ref(data.value[0].structureImg)
const IdeImg1 = ref(data.value[0].ideateImg1)
const IdeImg2 = ref(data.value[0].ideateImg2)
const IdeImg3 = ref(data.value[0].ideateImg3)
const empMap1 = ref(data.value[0].empathyMapImg1)
const empMap2 = ref(data.value[0].empathyMapImg2)
const lofi1 = ref(data.value[0].lofiWiImg1)
const lofi2 = ref(data.value[0].lofiWiImg2)
const lofi3 = ref(data.value[0].lofiWiImg3)
const lofi4 = ref(data.value[0].lofiWiImg4)
const lofi5 = ref(data.value[0].lofiWiImg5)

const router = useRouter();

const goToPortfolioPage = () => {
    router.push({ name: 'Portfolio' });
}

console.log(subTitle.value);

</script>

<template>
    <div>
        <backSVG @click="goToPortfolioPage" class="cursor-pointer mb-4" />
        <!--Title-->
        <h1 class="flex mx-auto font-bold text-2xl sm:text-3xl text-[#F2F2F2]">
            {{ portName }}
        </h1>
        <!--Sub Title-->
        <p class="text-[#8A949C] mt-2 text-lg sm:text-xl">{{ subTitle }}</p>

        <div>



            <!--Project banner-->
            <img :src="imgSrc" alt="project image" class="w-auto mt-10 mb-6">






            <!--Project Overview section-->
            <div class="w-full grid grid-cols-12 gap-4 mt-6">

                <!-- Overview -->
                <div class="col-span-12 md:col-span-8 bg-[#101010] 
    border border-[#ffffff]/5 rounded-xl flex flex-col justify-between">
                    <!-- Added flex, flex-col, and justify-between -->

                    <div> <!-- Wrapped the content in an additional div -->
                        <h1 class="text-[#8A949C] text-base font-medium mt-6 mx-6 ">Overview</h1>
                        <p class="text-[#F2F2F2] text-lg sm:text-xl mt-4 mx-6 break-words font-light  ">
                            WaterMap is the prototype for navigating location of drinking water in KMUTT. The prototype
                            is
                            designed by design thinking approach.
                        </p>
                    </div>

                    <div class="flex justify-end mx-6 mb-6 mt-4">
                        <a href="https://www.figma.com/proto/KBpJsZi23Yn08yZkwe0zGd/WaterMap?page-id=&node-id=424-0&viewport=1466%2C955%2C0.28&t=dqIprcsnGJsUPvBt-1&scaling=min-zoom&content-scaling=fixed&starting-point-node-id=424%3A0&show-proto-sidebar=1"
                            target="_blank" class="flex text-white bg-[#141414] my-2 rounded-xl px-3 py-3 
            transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F] border border-[#ffffff]/5">
                            Check the prototype
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
                                    <figmaIcon class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-sm sm:text-base text-white whitespace-nowrap">Figma</span>
                            </div>
                        </div>
                    </div>
                    <div class="mt-6">
                        <!-- More/Method -->
                        <h1 class="text-[#8A949C] text-base font-medium mx-4 ">Method</h1>
                        <div class="w-full mt-4 mx-4 mb-6">
                            <div class=" flex flex-wrap gap-2">
                                <div class="flex items-center px-3 py-2 border border-[#ffffff]/5 rounded-full">
                                    <span class="inline-block align-middle mr-2">
                                        <lightIcon class="h-6 w-6 fill-white" />
                                    </span>
                                    <span class="text-sm sm:text-base text-white whitespace-nowrap">Design
                                        Thinking</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            <!--Description-->

            <div>

                <!--Problem Statement-->
                <div class="mt-10">
                    <h1 class="text-white text-xl sm:text-2xl font-medium mb-6">Problem Statement</h1>
                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light">Water dispensers and water vending machines
                        are hard to find within KMUTT, and there is uncertainty about the availability of those water
                        service points.</p>
                    <img :src="problemImg" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">
                </div>

                <!--Solution-->
                <div class="mt-10">
                    <h1 class="text-white text-xl sm:text-2xl font-medium mb-6">Solution</h1>
                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light">We designed an application to locate water
                        dispensers and provide essential details for users.</p>
                </div>

                <!--Target User-->
                <div class="mt-10">
                    <h1 class="text-white text-xl sm:text-2xl font-medium mb-6">Target User</h1>
                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light">End users of this application would be
                        general users of water service points, segmented into three groups
                        <span class="ml-4 mt-4 block">• Mainstream users: Students, and staff in KMUTT.</span>
                        <span class="ml-4 mt-4 block">• Extreme users: First-time visitors to the campus, people
                            concerned about water cleanliness</span>
                        <span class="ml-4 mt-4 block">• Expert users: Frequent users of water service points and water
                            service staff.</span>
                    </p>
                </div>

                <!--Empathy Map-->
                <div class="mt-10">
                    <h1 class="text-white text-xl sm:text-2xl font-medium mb-6">Empathy Map</h1>
                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light">The analysis of empathy maps for both
                        mainstream and extreme users is shown in the images below.</p>

                    <!--Pagination-->

                    <swiper class=" text-white w-auto mt-6 mb-6 rounded-xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="empMap1" alt="project image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="empMap2" alt="problem image" class="w-auto" /></swiper-slide>

                    </swiper>
                </div>

                <!--Ideate-->
                <div class="mt-10">
                    <h1 class="text-white text-xl sm:text-2xl font-medium mb-6">Ideate</h1>
                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light">Our team conducted several problem case
                        analyses to generate as many ideas as possible, which we can then measure against cool and
                        feasible factors.</p>


                    <!--Pagination-->

                    <swiper class=" text-white w-auto mt-6 mb-6 rounded-xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="IdeImg1" alt="project image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="IdeImg2" alt="problem image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="IdeImg3" alt="structure image" class="w-auto" /></swiper-slide>
                    </swiper>
                </div>

                <!--Structure Design-->
                <div class="mt-10">
                    <h1 class="text-white text-xl sm:text-2xl font-medium mb-6">Structure Design</h1>
                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light">WaterMap application consists of 5 main
                        components
                        <span class="ml-4 mt-4 block">• Discover: This page allows users to explore all of drinking
                            water points in KMUTT.</span>
                        <span class="ml-4 mt-4 block">• Nearby: Users can locate nearby drinking water point based on
                            their current location.</span>
                        <span class="ml-4 mt-4 block">• Filters: Enables users to customize their view by applying
                            filters based on parameters like distances, drinking water categories.</span>
                        <span class="ml-4 mt-4 block">• Notification: Provides updates regarding changes for each
                            drinking water points.</span>
                        <span class="ml-4 mt-4 block">• Popup: Interactive pop-ups with information when users press on
                            specific drinking water points on the map.</span>
                    </p>
                    <img :src="strucImg" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">
                </div>

                <!--Lo-Fi Wireframes & Flows-->
                <div class="mt-10">
                    <h1 class="text-white text-xl sm:text-2xl font-medium mb-6">Lo-Fi Wireframes & Flows</h1>
                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light">The images below represent the draft design
                        of WaterMap, showing the application's flow from the beginning through its various features.</p>

                    <!--Pagination-->

                    <swiper class=" text-white w-auto mt-6 mb-6 rounded-xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="lofi1" alt="project image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="lofi2" alt="problem image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="lofi3" alt="structure image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="lofi4" alt="structure image" class="w-auto" /></swiper-slide>
                        <swiper-slide><img :src="lofi5" alt="structure image" class="w-auto" /></swiper-slide>
                    </swiper>
                </div>

                <!--Final Design-->
                <div class="mt-10">
                    <h1 class="text-white text-xl sm:text-2xl font-medium mb-6">Final Design</h1>
                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light">Experience the prototype of WaterMap from
                        the link below. Explore the application's features and flow.</p>
                    <div class="mt-6 rounded-xl">
                        <iframe class="flex mx-auto w-full h-screen"
                            src="https://www.figma.com/embed?embed_host=share&url=https%3A%2F%2Fwww.figma.com%2Fproto%2FKBpJsZi23Yn08yZkwe0zGd%2FWaterMap%3Fpage-id%3D0%253A1%26node-id%3D424-0%26viewport%3D1549%252C787%252C0.22%26t%3DzaCY9nn9z0gLT11w-1%26scaling%3Dmin-zoom%26content-scaling%3Dfixed%26starting-point-node-id%3D424%253A0"
                            allowfullscreen>
                        </iframe>
                    </div>
                </div>

                <!--Go next-->
                <div class="mt-10">
                    <h1 class="text-white text-lg sm:text-xl font-medium mb-6">Where should I go next?</h1>
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