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
        hifiWire1:hifiWire1,
        hifiWire2:hifiWire2,
        designSys:designSys

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
                        MOD RIDE is a ride-sharing web application that focuses on users from the KMUTT who want to find
                        friends to travel to similar destinations. Users can share their trip event and ask other to
                        join them, helping to split costs and lessen traffic both in and around campus. Additionally, it
                        encourages people from difference faculties to meet and get to know each other better.
                    </p>

                    <div class="flex justify-end mx-6 mb-6 mt-4 disabled opacity-25">
                        <a href="https://capstone23.sit.kmutt.ac.th/un2/" target="_blank" class="flex text-white bg-[#141414] my-2 rounded-xl px-3 py-3 
                            transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F] border border-[#ffffff]/5 cursor-not-allowed  ">
                            Check the web app
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
                                    <figmaIcon class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-base sm:text-sm text-white whitespace-nowrap">Figma & FigJam</span>
                            </div>
                        </div>
                    </div>

                    <div class="w-full mt-4 mx-4">
                        <div class=" flex flex-wrap gap-2">
                            <div class="flex items-center px-3 py-2  border border-[#ffffff]/5 rounded-full">
                                <span class="inline-block align-middle mr-2">
                                    <vsCodeIcon class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-base sm:text-sm text-white whitespace-nowrap">Visual Studio
                                    Code</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6">
                        <!-- More/Method -->
                        <h1 class="text-[#8A949C] text-base font-medium  mx-4 ">More</h1>

                        <div @click="goToReportDoc()" class="w-full mt-4 mx-4 mb-6 ">
                            <div class=" flex flex-wrap gap-2">
                                <div class="flex items-center px-3 py-2 cursor-pointer transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]
                                  border border-[#ffffff]/5 rounded-full">
                                    <span class="inline-block align-middle mr-2">
                                        <documentIcon class="h-6 w-6 fill-white" />
                                    </span>
                                    <span class="text-base sm:text-sm text-white whitespace-nowrap">Project
                                        Report</span>
                                    <GoSVG class="ml-2 inline-block fill-white w-6 h-6" viewBox="0 0 40 40" />
                                </div>
                            </div>
                        </div>

                        <div @click="goToSitPort()" class="w-full mt-4 mx-4 mb-6">
                            <div class=" flex flex-wrap gap-2">
                                <div class="flex items-center px-3 py-2 cursor-pointer transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]
                                  border border-[#ffffff]/5 rounded-full">
                                    <span class="inline-block align-middle mr-2">
                                        <externalIcon class="h-6 w-6 fill-white" />
                                    </span>
                                    <span class="text-base sm:text-sm text-white whitespace-nowrap">SIT Portfolio</span>
                                    <GoSVG class="ml-2 inline-block fill-white w-6 h-6" viewBox="0 0 40 40" />
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
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Background and Rationale</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light mb-4">As COVID-19 eased in Thailand, KMUTT
                        resumed onsite learning, leading to heavy traffic, limited parking, and increased pollution from
                        personal vehicles.</p>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">We propose a ride-sharing system to reduce
                        traffic both inside and outside KMUTT, while also
                        building a stronger community at KMUTT.</p>

                </div>

                <!--Feasibility Study-->
                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Feasibility Study</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light mb-4">We conducted several online surveys
                        with target users and discovered that the main thing people consider others to get into their
                        vehicle is "How close their friendship is"</p>

                    <img :src="feStu1" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light mb-4">The survey response has broadened our
                        design guidelines from a regular ride-sharing web app to a ride-sharing community for KMUTT that
                        can provide users with a sense of KMUTT's environment and rich features, encouraging people to
                        use the ride-sharing web app.</p>

                    <img :src="feStu2" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light mb-4">After ideating the features of MOD
                        RIDE, we also explored an existing ride-sharing app available in Thailand called "LILUNA." We
                        analyzed and compared features in order to demonstrate how our web app is different.</p>

                    <img :src="feStu3" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light mb-4">Both systems have similar features,
                        but the user scopes are completely different. MOD RIDE focuses on building trust and confidence
                        in ride-sharing. To achieve this goal, we have designed a social network and other features that
                        are specifically designed for the KMUTT environment, enhancing the overall user experience.</p>

                </div>




                <!--Sitemap-->
                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Sitemap</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">MOD RIDE sitemap design outlines the
                        navigation structure and key features of the ride-sharing application, catering to various user
                        roles including regular users, driver users, and admin users.</p>

                    <img :src="siteMapImg" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                </div>


                <!--User Flows-->
                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">User Flows</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">There are 4 main user flows that cover the
                        overall features in this web application.</p>

                    <img :src="uf1" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light flex justify-center italic">New User Create
                        Account Flow</p>

                    <img :src="uf2" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light flex justify-center italic">Passenger Users
                        Flow</p>

                    <img :src="uf3" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light flex justify-center italic">Driver Users
                        Flow</p>

                    <img :src="uf4" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light flex justify-center italic">Driver Approval
                        - Admin Flow</p>

                </div>


                <!--Hi-Fi Wireframes-->
                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Hi-Fi Wireframes</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">The wireframe design for MOD RIDE inclueds
                        more than 20 screens, covering both mobile and desktop intefaces</p>

                    <img :src="hifi1" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light flex justify-center italic">Mobile Screen for Normal Users</p>

                    <img :src="hifi2" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light flex justify-center italic">Desktop Screen for Admin Users</p>

                </div>


                <!--Design System-->
                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Design System</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">MOD RIDE design system is designed to reflect the identity of King Mongkut's University of Technology Thonburi (KMUTT) and provide a familiar experience for its users. </p>

                    <img :src="desys1" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                  

                </div>











                <!--Core Features-->
                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Core Features</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">Watch the video below for an overall features of MOD RIDE - Ride Sharing in KMUTT.</p>
                    <div class="mt-6 rounded-xl">
                        


                        <iframe class="flex mx-auto w-full h-[400px]" src="https://www.youtube.com/embed/CABxUrGL_MM?si=UmySYW7AHCPPVSma" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
                    </div>
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