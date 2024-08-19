<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, } from 'vue-router';

import ekycImg from '../../assets/portfolios/customer-personality-analysis.png'

import backSVG from '../../assets/arrow-left.svg'

import hiLightImg1 from '../../assets/portfolios/customer-1.jpg'











import GoSVG from '../../assets/bubble.svg'
import RSVG from '../../assets/rstudio.svg'
import excelSVG from '../../assets/excel.svg'
import powerSVG from '../../assets/powerbi.svg'







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
        portName: 'Customer Personality Analysis',
        category: 'Other',
        imgSrc: ekycImg,
        subTitle: 'Statistics for IT 2021',
        hiLightImg1: hiLightImg1,


    }
])

const portName = ref(data.value[0].portName)
const subTitle = ref(data.value[0].subTitle)
const imgSrc = ref(data.value[0].imgSrc)
const hiImg1 = ref(data.value[0].hiLightImg1)


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

const goToData = () => {
    window.open('https://www.kaggle.com/datasets/imakash3011/customer-personality-analysis', '_blank')
}




console.log(subTitle.value);

</script>

<template>
    <div>
        <backSVG @click="goToPortfolioPage" class="cursor-pointer mb-4" />
        <!--Title-->
        <h1 class="flex mx-auto font-bold text-2xl sm:text-3xl text-[#2F80ED]">
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
border border-[#B5B5B5] rounded-3xl flex flex-col justify-between">

                    <div>
                        <h1 class="text-[#0D99FF] text-base font-bold mt-6 mx-6">Overview</h1>
                        <p class="text-[#1c1c1c] text-lg sm:text-xl mt-4 mx-6 break-words font-light">
                             WaterMap is the prototype for navigating location of drinking water in KMUTT. The prototype is designed by design thinking approach.
                        </p>
                    </div>

                    <div class="flex justify-end mx-6 mb-6 mt-4 ">
                        <a href="https://app.powerbi.com/view?r=eyJrIjoiN2M4NTVjZGQtZDBjOS00NjFmLWJmMWEtNjU1NDgxMTY3NWE5IiwidCI6IjZmNDQzMmRjLTIwZDItNDQxZC1iMWRiLWFjMzM4MGJhNjMzZCIsImMiOjEwfQ%3D%3D"
                            target="_blank" class="flex items-center text-white bg-[#0D99FF] my-2 rounded-3xl 
px-4 py-2 transition-colors duration-300 ease-in-out hover:bg-[#055c9b] ">
                            View dashboard
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
                <div class="col-span-12 md:col-span-4 bg-white
border border-[#B5B5B5] rounded-3xl mt-2 sm:mt-0
px-2 py-2">

                    <!-- Tools -->
                    <h1 class="text-[#0D99FF] text-base font-bold mt-4 mx-4">Tools</h1>
                    <div class="w-full mt-4 mx-4">
                        <div class="">
                            <div class="flex items-center my-2 py-2 ">
                                <span class="inline-block align-middle mr-2">
                                    <RSVG class="h-6 w-6 fill-[#0D99FF]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap">R Studio </span>
                            </div>

                            <div class="flex items-center my-2 py-2 ">
                                <span class="inline-block align-middle mr-2">
                                    <excelSVG class="h-6 w-6 fill-[#0D99FF]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap">Excel</span>
                            </div>

                            <div class="flex items-center my-2 py-2 ">
                                <span class="inline-block align-middle mr-2">
                                    <powerSVG class="h-6 w-6 fill-[#0D99FF]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap">Power BI</span>
                            </div>


                        </div>
                    </div>

                    <div class="mt-6">
                        <!-- More/Method -->
                        <h1 class="text-[#0D99FF] text-base font-bold mx-4">Learn more</h1>
                        <div @click="goToData()"
                            class="mt-4 mx-4 mb-4 cursor-pointer rounded-xl transition-colors duration-300 ease-in-out hover:bg-blue-50 ">
                            <div class="">
                                <div class="flex items-center px-3 py-2  ">
                                    <span class="inline-block align-middle mr-2">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                            xmlns="http://www.w3.org/2000/svg">
                                            <path
                                                d="M12 3H7C4.79086 3 3 4.79086 3 7V17C3 19.2091 4.79086 21 7 21H17C19.2091 21 21 19.2091 21 17V12"
                                                stroke="black" stroke-width="2" stroke-linecap="round" class="my-path">
                                            </path>
                                            <path d="M21 3L21 9M21 3H15M21 3L14 10" stroke="black" stroke-width="2"
                                                stroke-linecap="round" stroke-linejoin="round" class="my-path"></path>
                                        </svg>
                                    </span>
                                    <span
                                        class="text-sm sm:text-base text-[#1c1c1c] space-nowrap ">www.kaggle.com</span>

                                </div>
                            </div>
                        </div>

                        <!-- <div @click="goToEBook()" class="mx-4 mb-6 cursor-pointer transition-colors duration-300 ease-in-out
hover:bg-blue-50 rounded-xl">
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
        class="text-sm sm:text-base text-[#1c1c1c] [#F04E23] space-nowrap font-bold">e-Book
        </span>

</div>
</div>
</div> -->
                    </div>
                </div>
            </div>









            <!--Description-->

            <div>

                <!-- Modal -->
                <div v-if="isModalOpen"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    @click="closeModal">
                    <img :src="currentImage" class="max-w-full max-h-full rounded-lg scale-95 md:scale-100 ">

                </div>


                <!--Product Overview-->
                <div class="mt-10">
                    <h1 class="text-[#2F80ED] text-xl sm:text-2xl font-bold mb-6">Working Process</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">There are 5 processes of this data analysis
                        project.</p>


                    <img :src="hiImg1" alt="project image" class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                        @click="openModal(hiImg1)"
>

                </div>

                <!--Responsibilities as Intern-->
                <div class="mt-10">
                    <h1 class="text-[#2F80ED] text-xl sm:text-2xl font-bold mb-6">Data Visualization</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">
                        Implemented by Power BI.
                    </p>

                    <div class="mt-6 rounded-xl">
                        <iframe class="flex mx-auto w-full h-[300px] sm:h-[700px]"
                            src="https://app.powerbi.com/view?r=eyJrIjoiN2M4NTVjZGQtZDBjOS00NjFmLWJmMWEtNjU1NDgxMTY3NWE5IiwidCI6IjZmNDQzMmRjLTIwZDItNDQxZC1iMWRiLWFjMzM4MGJhNjMzZCIsImMiOjEwfQ%3D%3D"
                            frameborder="0" allowFullScreen="true">
                        </iframe>
                    </div>

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light mt-6">
                        Learn more about the project: <a
                            href="https://github.com/sit-2021-int214/033-Customer-Personality-Analysis?tab=readme-ov-file"
                            target="_blank" class="text-[#2F80ED] hover:underline">GitHub</a>
                    </p>


                </div>

                <!--Go next-->
                <div class="mt-10">
                    <h1 class="text-[#2F80ED] text-lg sm:text-xl font-bold mb-6">Where should I go next?</h1>
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