<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, } from 'vue-router';

import ekycImg from '../../assets/portfolios/hotel-kiosk.png'

import backSVG from '../../assets/arrow-left.svg'

import hiLightImg1 from '../../assets/portfolios/hc-1.jpg'
import hiLightImg2 from '../../assets/portfolios/hc-2.jpg'
import hiLightImg3 from '../../assets/portfolios/hc-3.jpg'
import hiLightImg4 from '../../assets/portfolios/hc-4.jpg'










import GoSVG from '../../assets/bubble.svg'
import figmaIcon from '../../assets/figma-icon.svg'
import lightIcon from '../../assets/light-blub-icon.svg'
import jiraIcon from '../../assets/jira-icon.svg'
import mondayIcon from '../../assets/monday-icon.svg'





import { Swiper, SwiperSlide } from 'swiper/vue';
import { Pagination, Navigation } from 'swiper/modules'


// import { EffectCube } from "swiper/vue"


import 'swiper/swiper-bundle.css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

// import "swiper/css/effect-cube"

const data = ref([
    {
        portId: 5,
        portName: 'Hotel Check-in Kiosk',
        category: 'UX/UI',
        imgSrc: ekycImg,
        subTitle: 'UX/UI Design Internship 2023',
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



const isModalOpen = ref(false);
const currentImage = ref(null);

function openModal(image) {
    currentImage.value = image;
    isModalOpen.value = true;
}

function closeModal() {
    isModalOpen.value = false;
}


const router = useRouter();

const goToPortfolioPage = () => {
    router.push({ name: 'Portfolio' });
}

const goToAppMan = () => {
    window.open('https://www.appman.co.th/', '_blank')
}




console.log(subTitle.value);

</script>

<template>
    <div>
        <backSVG @click="goToPortfolioPage" class="cursor-pointer mb-4" />
        <!--Title-->
        <h1 class="flex mx-auto font-bold text-2xl sm:text-3xl text-[#F32735]">
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
                <div class="col-span-12 md:col-span-8 bg-white
border border-[#B5B5B5] rounded-3xl ">

                    <h1 class="text-[#F32735] text-base font-bold mt-6 mx-6 ">Overview</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl mt-4 mx-6 break-words font-light  ">
                        The UI concepts for a hotel check-in kiosk integrated with AppMan's E-KYC (Electronic Know Your
                        Customer) solution.





                    </p>

                    <div class="flex justify-end mx-6 mb-6 mt-4 opacity-0 ">
                        <!-- <a href="https://www.figma.com/proto/KBpJsZi23Yn08yZkwe0zGd/WaterMap?page-id=&node-id=424-0&viewport=1466%2C955%2C0.28&t=dqIprcsnGJsUPvBt-1&scaling=min-zoom&content-scaling=fixed&starting-point-node-id=424%3A0&show-proto-sidebar=1"
target="_blank" class="flex text-[#F32735] bg-[#141414] my-2 rounded-xl px-3 py-3 
transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F] border border-[#ffffff]/5">
Check the prototype
<GoSVG class="ml-2 inline-block fill-[#F32735] w-6 h-6" viewBox="0 0 40 40" />
</a> -->
                    </div>
                </div>

                <!-- Right column -->
                <div
                    class="col-span-12 md:col-span-4 mt-2 sm:mt-0 bg-white border border-[#B5B5B5] rounded-3xl px-2 py-2 ">

                    <!-- Tools -->
                    <h1 class="text-[#F32735] text-base font-bold mt-4 mx-4 ">Tools</h1>
                    <div class="w-full mt-4 mx-4">
                        <div class="">
                            <div class="flex items-center  py-2 my-2">
                                <span class="inline-block align-middle mr-2">
                                    <figmaIcon class="h-6 w-6 fill-[#F32735]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap">Figma +
                                    FigJam</span>
                            </div>

                            <div class="flex items-center py-2 my-2">
                                <span class="inline-block align-middle mr-2">
                                    <jiraIcon class="h-6 w-6 fill-[#F32735]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap">Jira</span>
                            </div>

                            <div class="flex items-center  py-2  my-2">
                                <span class="inline-block align-middle mr-2">
                                    <mondayIcon class="h-6 w-6 fill-[#F32735]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap">Monday</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6">
                        <!-- More/Method -->
                        <h1 class="text-[#F32735] text-base font-bold  mx-4 ">Company</h1>
                        <div @click="goToAppMan()"
                            class="mt-4 mx-4 mb-4 cursor-pointer rounded-xl transition-colors duration-300 ease-in-out hover:bg-red-50 ">
                            <div class="flex flex-wrap gap-2">
                                <div class="flex items-center px-3 py-2  ">
                                    <span class="inline-block align-middle mr-2">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                            xmlns="http://www.w3.org/2000/svg">
                                            <path
                                                d="M12 3H7C4.79086 3 3 4.79086 3 7V17C3 19.2091 4.79086 21 7 21H17C19.2091 21 21 19.2091 21 17V12"
                                                stroke="black" stroke-width="2" stroke-linecap="round" class="my-path">
                                            </path>
                                            <path d="M21 3L21 9M21 3H15M21 3L14 10" stroke="black" stroke-width="2"
                                                stroke-linecap="round" stroke-linejoin="round" class="my-path"></path>
                                        </svg>
                                    </span>
                                    <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap ">AppMan
                                        Co., Ltd.</span>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!--Description-->

            <div>

                <!-- Modal -->
                <div v-if="isModalOpen"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    @click="closeModal">
                    <img :src="currentImage" class="max-w-full max-h-full rounded-lg scale-95 md:scale-125 ">

                </div>

                <!--Product Overview-->
                <div class="mt-10">
                    <h1 class="text-[#F32735] text-xl sm:text-2xl font-bold mb-6">Work Flows</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light mb-4">I collaborated with the Product Owner
                        (PO)
                        of the E-KYC product to create this concept for the hotel check-in kiosk, which they will use to
                        present to customers.

                    </p>

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">I was a member of the MAC team, which
                        focuses on SaaS (Software as a Service) products, with E-KYC being one of the highlights. E-KYC
                        is typically used on mobile and desktop devices, but the business team wants to expand the
                        potential of e-kyc solution. So, we created this hotel check-in kiosk to show how E-KYC can make
                        the check-in process faster and more secure.

                    </p>

                    <!--Pagination-->

                    <swiper class=" text-[#fff] w-auto mt-6 mb-6 rounded-xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="hiImg1" alt="project image"
                                class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(hiImg1)" /></swiper-slide>
                        <swiper-slide><img :src="hiImg2" alt="problem image"
                                class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(hiImg2)" /></swiper-slide>
                        <swiper-slide><img :src="hiImg3" alt="problem image"
                                class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(hiImg3)" /></swiper-slide>
                        <swiper-slide><img :src="hiImg4" alt="problem image"
                                class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(hiImg4)" /></swiper-slide>


                    </swiper>



                </div>
















                <!--Go next-->
                <div class="mt-10">
                    <h1 class="text-[#F32735] text-lg sm:text-xl font-bold mb-6">Where should I go next?</h1>
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