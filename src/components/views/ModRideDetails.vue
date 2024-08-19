<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, } from 'vue-router';

import modRideImg from '../../assets/portfolios/MODRIDE.png'
import externalSVG from '../../assets/arrow-square-out.svg'
import backSVG from '../../assets/arrow-left.svg'
import feStuImg1 from '../../assets/portfolios/modride-fe-1.jpg'
import feStuImg2 from '../../assets/portfolios/modride-fe-2.jpg'
import feStuImg3 from '../../assets/portfolios/modride-fe-3.jpg'

import siteMap from '../../assets/portfolios/modride-sitemap.jpg'

import userFlow1 from '../../assets/portfolios/modride-uf-1.jpg'
import userFlow2 from '../../assets/portfolios/modride-uf-2.jpg'
import userFlow3 from '../../assets/portfolios/modride-uf-3.jpg'
import userFlow4 from '../../assets/portfolios/modride-uf-4.jpg'

import hifiWire1 from '../../assets/portfolios/modride-hifi-1.jpg'
import hifiWire2 from '../../assets/portfolios/modride-hifi-2.jpg'

import designSys from '../../assets/portfolios/modride-desys-1.jpg'

import ddayImg1 from '../../assets/portfolios/modride-dday-1.jpg'
import ddayImg2 from '../../assets/portfolios/modride-dday-2.jpg'
import ddayImg3 from '../../assets/portfolios/modride-dday-3.jpg'
import ddayImg4 from '../../assets/portfolios/modride-dday-4.jpg'
















import GoSVG from '../../assets/bubble.svg'
import figmaIcon from '../../assets/figma-icon.svg'
import documentIcon from '../../assets/document-report.svg'
import externalIcon from '../../assets/external-site.svg'
import vsCodeIcon from '../../assets/vs-code.svg'






import { Swiper, SwiperSlide } from 'swiper/vue';
import { Pagination, Navigation } from 'swiper/modules'


// import { EffectCube } from "swiper/vue"


import 'swiper/swiper-bundle.css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

// import "swiper/css/effect-cube"


const isModalOpen = ref(false);
const currentImage = ref(null);

function openModal(image) {
    currentImage.value = image;
    isModalOpen.value = true;
}

function closeModal() {
    isModalOpen.value = false;
}

const data = ref([
    {
        portId: 1,
        portName: 'MOD RIDE - Ride Sharing in KMUTT',
        category: 'UX/UI',
        imgSrc: modRideImg,
        subTitle: 'Capstone Project 2023 - 2024',
        feStuImg1: feStuImg1,
        feStuImg2: feStuImg2,
        feStuImg3: feStuImg3,
        siteMap: siteMap,
        userFlow1: userFlow1,
        userFlow2: userFlow2,
        userFlow3: userFlow3,
        userFlow4: userFlow4,
        hifiWire1: hifiWire1,
        hifiWire2: hifiWire2,
        designSys: designSys,
        ddayImg1: ddayImg1,
        ddayImg2: ddayImg2,
        ddayImg3: ddayImg3,
        ddayImg4: ddayImg4

    }
])

const portName = ref(data.value[0].portName)
const subTitle = ref(data.value[0].subTitle)
const imgSrc = ref(data.value[0].imgSrc)
const feStu1 = ref(data.value[0].feStuImg1)
const feStu2 = ref(data.value[0].feStuImg2)
const feStu3 = ref(data.value[0].feStuImg3)

const siteMapImg = ref(data.value[0].siteMap)

const uf1 = ref(data.value[0].userFlow1)
const uf2 = ref(data.value[0].userFlow2)
const uf3 = ref(data.value[0].userFlow3)
const uf4 = ref(data.value[0].userFlow4)

const hifi1 = ref(data.value[0].hifiWire1)
const hifi2 = ref(data.value[0].hifiWire2)

const desys1 = ref(data.value[0].designSys)

const dday1 = ref(data.value[0].ddayImg1)
const dday2 = ref(data.value[0].ddayImg2)
const dday3 = ref(data.value[0].ddayImg3)
const dday4 = ref(data.value[0].ddayImg4)










const router = useRouter();

const goToPortfolioPage = () => {
    router.push({ name: 'Portfolio' });
}

const goToReportDoc = () => {
    window.open('https://drive.google.com/file/d/1zmr1g_J9X4K1asoawRgPZo6_sT8mbein/view?usp=sharing', '_blank')
}

const goToSitPort = () => {
    window.open('https://seniorproject.sit.kmutt.ac.th/showproject/IT63-BU34', '_blank')
}



console.log(subTitle.value);

</script>

<template>
    <div>
        <backSVG @click="goToPortfolioPage" class="cursor-pointer mb-4" />
        <!--Title-->
        <h1 class="flex mx-auto font-bold text-2xl sm:text-3xl text-[#F04E23]">
            {{ portName }}
        </h1>
        <!--Sub Title-->
        <p class="text-slate-500 mt-2 text-lg sm:text-xl">{{ subTitle }}</p>

        <div>



            <!--Project banner-->
            <img :src="imgSrc" alt="project image" class="w-auto mt-10 mb-6 rounded-2xl">

            <!--Project Overview section-->
            <div class="w-full grid grid-cols-12 gap-4 mt-6">

                <!-- Overview -->
                <div class="col-span-12 md:col-span-8 bg-white 
                border border-[#B5B5B5] rounded-3xl flex flex-col justify-between">
                    <!-- Added flex, flex-col, and justify-between -->

                    <div> <!-- Wrapped the content in an additional div -->
                        <h1 class="text-[#F04E23] text-base font-bold mt-6 mx-6 ">Overview</h1>
                        <p class="text-[#1c1c1c] text-base sm:text-lg mt-4 mx-6 break-words font-light  ">
                            MOD RIDE is a ride-sharing web application that focuses on users from the KMUTT who want to
                            find
                            friends to travel to similar destinations. Users can share their trip event and ask other to
                            join them, helping to split costs and lessen traffic both in and around campus.
                            Additionally, it
                            encourages people from different faculties to meet and get to know each other better.
                        </p>
                    </div>

                    <div class="flex justify-end mx-6 mb-6 mt-4 disabled opacity-20">
                        <a href="https://capstone23.sit.kmutt.ac.th/un2/" target="_blank"
                            class="flex items-center text-white bg-[#F04E23] my-2 rounded-3xl 
                            px-4 py-2 transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F] cursor-not-allowed  ">
                            Check the web app
                            <svg class="ml-2 inline-block w-4 h-4" viewBox="0 0 26 26" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M12 3H7C4.79086 3 3 4.79086 3 7V17C3 19.2091 4.79086 21 7 21H17C19.2091 21 21 19.2091 21 17V12"
                                    stroke="white" stroke-width="2" stroke-linecap="round" class="my-path"></path>
                                <path d="M21 3L21 9M21 3H15M21 3L14 10" stroke="white" stroke-width="2"
                                    stroke-linecap="round" stroke-linejoin="round" class="my-path"></path>
                            </svg>

                        </a>
                    </div>
                </div>

                <!-- Right column -->
                <div class="col-span-12 md:col-span-4 bg-white mt-2 sm:mt-0
    border border-[#B5B5B5] rounded-3xl px-2 py-2 ">

                    <!-- Tools -->
                    <h1 class="text-[#F04E23] text-base font-bold mt-4 mx-4 ">Tools</h1>

                    <div class="w-full mt-4 mx-4">
                        <div class="flex flex-wrap gap-2">
                            <div class="flex items-center px-3 py-2 ">
                                <span class="inline-block align-middle mr-2">
                                    <figmaIcon class="h-6 w-6 fill-[#F04E23]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#F04E23]space-nowrap">Figma +
                                    FigJam</span>
                            </div>
                        </div>
                    </div>

                    <div class="w-full mt-4 mx-4">
                        <div class="flex flex-wrap gap-2">
                            <div class="flex items-center px-3 py-2 ">
                                <span class="inline-block align-middle mr-2">
                                    <vsCodeIcon class="h-6 w-6 fill-[#F04E23]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#F04E23]space-nowrap">Visual Studio
                                    Code</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6">
                        <!-- More/Method -->
                        <h1 class="text-[#F04E23] text-base font-bold mx-4 ">Learn more</h1>

                        <div @click="goToReportDoc()"
                            class="mt-4 mx-4 mb-4 cursor-pointer rounded-xl transition-colors duration-300 ease-in-out hover:bg-orange-50 ">
                            <div class="flex flex-wrap gap-2">
                                <div class="flex items-center px-3 py-2  ">
                                    <span class="inline-block align-middle mr-2">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                            xmlns="http://www.w3.org/2000/svg">
                                            <path
                                                d="M10 21H14C16.8284 21 18.2426 21 19.1213 20.1213C20 19.2426 20 17.8284 20 15V9.0208C20 8.26895 20 7.89303 19.8694 7.54964C19.7389 7.20625 19.4891 6.92528 18.9896 6.36334L17.1934 4.34254C16.6058 3.68154 16.312 3.35104 15.9212 3.17552C15.5303 3 15.0881 3 14.2037 3H10C7.17157 3 5.75736 3 4.87868 3.87868C4 4.75736 4 6.17157 4 9V15C4 17.8284 4 19.2426 4.87868 20.1213C5.75736 21 7.17157 21 10 21Z"
                                                stroke="#000000" stroke-width="2" class="my-path"></path>
                                            <path
                                                d="M14.5 3V6C14.5 6.46466 14.5 6.69698 14.5384 6.89018C14.6962 7.68356 15.3164 8.30376 16.1098 8.46157C16.303 8.5 16.5353 8.5 17 8.5H20"
                                                stroke="#000000" stroke-width="2" class="my-path"></path>
                                            <path d="M7 13H15" stroke="#000000" stroke-width="2" stroke-linecap="round"
                                                class="my-path"></path>
                                            <path d="M7 16H12" stroke="#000000" stroke-width="2" stroke-linecap="round"
                                                class="my-path"></path>
                                        </svg>
                                    </span>
                                    <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap font-medium">Project
                                        Document</span>

                                </div>
                            </div>
                        </div>

                        <div @click="goToSitPort()" class="mx-4 mb-6 cursor-pointer transition-colors duration-300 ease-in-out
                        hover:bg-orange-50 rounded-xl">
                            <div class="flex flex-wrap gap-2">
                                <div class="flex items-center px-3 py-2 ">
                                    <span class="inline-block align-middle mr-2">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                            xmlns="http://www.w3.org/2000/svg">
                                            <path
                                                d="M12 3H7C4.79086 3 3 4.79086 3 7V17C3 19.2091 4.79086 21 7 21H17C19.2091 21 21 19.2091 21 17V12"
                                                stroke="#000000" stroke-width="2" stroke-linecap="round"
                                                class="my-path"></path>
                                            <path d="M21 3L21 9M21 3H15M21 3L14 10" stroke="#000000" stroke-width="2"
                                                stroke-linecap="round" stroke-linejoin="round" class="my-path"></path>
                                        </svg>
                                    </span>
                                    <span
                                        class="text-sm sm:text-base text-[#1c1c1c] [#F04E23] space-nowrap font-medium">SIT
                                        Portfolio</span>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            <!--Description-->

            <div>

                <!--Background and Rationale-->
                <div class="mt-10">
                    <h1 class="text-[#F04E23] text-xl sm:text-2xl font-bold mb-6">Background and Rationale</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light mb-4">As COVID-19 eased in Thailand, KMUTT
                        resumed onsite learning, leading to heavy traffic, limited parking, and increased pollution from
                        personal vehicles.</p>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">We propose a ride-sharing system to reduce
                        traffic both inside and outside KMUTT, while also
                        building a stronger community at KMUTT.</p>

                </div>

                <!--Feasibility Study-->
                <div class="mt-10">
                    <h1 class="text-[#F04E23] text-xl sm:text-2xl font-bold mb-6">Feasibility Study</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light mb-4">
                        We conducted several online surveys with target users and discovered that the main thing
                        people consider others to get into their vehicle is "How close their friendship is"
                    </p>

                    <!-- Images with click event to open modal -->
                    <img :src="feStu1" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(feStu1)">
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light mb-4">
                        The survey response has broadened our design guidelines from a regular ride-sharing web app
                        to a ride-sharing community for KMUTT that can provide users with a sense of KMUTT's
                        environment and rich features, encouraging people to use the ride-sharing web app.
                    </p>
                    <img :src="feStu2" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(feStu2)">
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light mb-4">
                        After ideating the features of MOD RIDE, we also explored an existing ride-sharing app
                        available in Thailand called "LILUNA." We analyzed and compared features in order to
                        demonstrate how our web app is different.
                    </p>
                    <img :src="feStu3" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(feStu3)">
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light mb-4">
                        Both systems have similar features, but the user scopes are completely different. MOD RIDE
                        focuses on building trust and confidence in ride-sharing. To achieve this goal, we have
                        designed a social network and other features that are specifically designed for the KMUTT
                        environment, enhancing the overall user experience.
                    </p>

                    <!-- Modal -->
                    <div v-if="isModalOpen"
                        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                        @click="closeModal">
                        <img :src="currentImage" class="max-w-full max-h-full rounded-lg scale-95 md:scale-125 ">

                    </div>
                </div>

                <!--Sitemap-->
                <div class="mt-10">
                    <h1 class="text-[#F04E23] text-xl sm:text-2xl font-bold mb-6">Sitemap</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">MOD RIDE sitemap design outlines the
                        navigation structure and key features of the ride-sharing application, catering to various user
                        roles including regular users, driver users, and admin users.</p>

                    <img :src="siteMapImg" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(siteMapImg)">

                </div>


                <!--User Flows-->
                <div class="mt-10">
                    <h1 class="text-[#F04E23] text-xl sm:text-2xl font-bold mb-6">User Flows</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">There are 4 main user flows that cover the
                        overall features in this web application.</p>

                    <img :src="uf1" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(uf1)">

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light flex justify-center italic">New User Create
                        Account Flow</p>

                    <img :src="uf2" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(uf2)">

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light flex justify-center italic">Passenger Users
                        Flow</p>

                    <img :src="uf3" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(uf3)">

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light flex justify-center italic">Driver Users
                        Flow</p>

                    <img :src="uf4" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(uf4)">

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light flex justify-center italic">Driver Approval
                        - Admin Flow</p>

                </div>


                <!--Hi-Fi Wireframes-->
                <div class="mt-10">
                    <h1 class="text-[#F04E23] text-xl sm:text-2xl font-bold mb-6">Hi-Fi Wireframes</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">The wireframe design for MOD RIDE inclueds
                        more than 20 screens, covering both mobile and desktop intefaces</p>

                    <img :src="hifi1" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(hifi1)">

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light flex justify-center italic">Mobile Screen
                        for Normal Users</p>

                    <img :src="hifi2" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(hifi2)">

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light flex justify-center italic">Desktop Screen
                        for Admin Users</p>

                </div>


                <!--Design System-->
                <div class="mt-10">
                    <h1 class="text-[#F04E23] text-xl sm:text-2xl font-bold mb-6">Design System</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">MOD RIDE design system is designed to
                        reflect the identity of King Mongkut's University of Technology Thonburi (KMUTT) and provide a
                        familiar experience for users. </p>

                    <img :src="desys1" alt="project image"
                        class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(desys1)">

                </div>

                <!--Core Features-->
                <div class="mt-10">
                    <h1 class="text-[#F04E23] text-xl sm:text-2xl font-bold mb-6">Core Features</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">Watch the video below for an overall
                        features of MOD RIDE - Ride Sharing in KMUTT.</p>
                    <div class="mt-6 rounded-xl">



                        <iframe class="flex mx-auto w-full h-[550px]"
                            src="https://www.youtube.com/embed/CABxUrGL_MM?si=UmySYW7AHCPPVSma"
                            title="YouTube video player" frameborder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
                    </div>
                </div>

                <!--D Day 2024-->
                <div class="mt-10">
                    <h1 class="text-[#F04E23] text-xl sm:text-2xl font-bold mb-6">SIT D-Day Exhibition 2024 </h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light mb-4">Here are some photos of our project
                        showcase at the SIT D-Day Exhibition 2024.</p>


                    <!--Pagination-->

                    <swiper class=" text-white w-auto mt-6 mb-6 rounded-xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="dday1" alt="project image"
                                class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105 "
                                @click="openModal(dday1)" /></swiper-slide>
                        <swiper-slide><img :src="dday2" alt="problem image"
                                class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105 "
                                @click="openModal(dday2)" /></swiper-slide>
                        <swiper-slide><img :src="dday3" alt="problem image"
                                class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105 "
                                @click="openModal(dday3)" /></swiper-slide>
                        <swiper-slide><img :src="dday4" alt="problem image"
                                class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105 "
                                @click="openModal(dday4)" /></swiper-slide>


                    </swiper>



                </div>

                <!--Go next-->
                <div class="mt-10">
                    <h1 class="text-[#F04E23] text-2xl sm:text-xl font-bold mb-6">Where should I go next?</h1>
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

.swiper-button-next {
    background-color: rgba(0, 0, 0, 0.5);
    width: 40px;
    height: 50px;
    color: white;
    border-radius: 4px;
}



.swiper-button-prev {
    background-color: rgba(0, 0, 0, 0.5);
    width: 40px;
    height: 50px;
    color: white;
    border-radius: 4px;
}
</style>