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
                            A data analytics project that uses detailed customer data to visualize their behavior,
                            helping
                            businesses understand the needs and concerns of different customer types better.
                        </p>
                    </div>

                    <div class="flex justify-end mx-6 mb-6 mt-4">
                        <a href="https://app.powerbi.com/view?r=eyJrIjoiN2M4NTVjZGQtZDBjOS00NjFmLWJmMWEtNjU1NDgxMTY3NWE5IiwidCI6IjZmNDQzMmRjLTIwZDItNDQxZC1iMWRiLWFjMzM4MGJhNjMzZCIsImMiOjEwfQ%3D%3D"
                            target="_blank"
                            class="flex text-white bg-[#141414] my-2 rounded-xl px-3 py-3 transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F] border border-[#ffffff]/5">
                            Dashboard
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
                                    <RSVG class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-sm sm:text-base text-white whitespace-nowrap">R Studio</span>
                            </div>

                            <div class="flex items-center px-3 py-2  border border-[#ffffff]/5 rounded-full">
                                <span class="inline-block align-middle mr-2">
                                    <excelSVG class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-sm sm:text-base text-white whitespace-nowrap">Excel</span>
                            </div>

                            <div class="flex items-center px-3 py-2  border border-[#ffffff]/5 rounded-full">
                                <span class="inline-block align-middle mr-2">
                                    <powerSVG class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-sm sm:text-base text-white whitespace-nowrap">Power BI</span>
                            </div>
                        </div>


                    </div>

                    <div class="mt-6">
                        <!-- More/Method -->
                        <h1 class="text-[#8A949C] text-base font-medium  mx-4 ">Dataset</h1>
                        <div @click="goToData()" class="w-full mt-4 mx-4 mb-6 ">
                            <div class=" flex flex-wrap gap-2">
                                <div class="flex items-center px-3 py-2 cursor-pointer transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]
                                  border border-[#ffffff]/5 rounded-full">
                                    <span class="inline-block align-middle mr-2">
                                        <documentIcon class="h-6 w-6 fill-white" />
                                    </span>
                                    <span
                                        class="text-sm sm:text-base text-white whitespace-nowrap">www.kaggle.com</span>
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
                    <h1 class="text-white text-xl sm:text-2xl font-medium mb-6">Working Process</h1>
                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light">There are 5 processes of this data analysis
                        project.</p>


                    <img :src="hiImg1" alt="project image" class="w-auto mt-6 mb-6 rounded-xl">

                </div>

                <!--Responsibilities as Intern-->
                <div class="mt-10">
                    <h1 class="text-white text-xl sm:text-2xl font-medium mb-6">Data Visualization</h1>
                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light">
                        Implemented by Power BI.
                    </p>

                    <div class="mt-6 rounded-xl">
                        <iframe class="flex mx-auto w-full h-[300px] sm:h-[700px]"
                            src="https://app.powerbi.com/view?r=eyJrIjoiN2M4NTVjZGQtZDBjOS00NjFmLWJmMWEtNjU1NDgxMTY3NWE5IiwidCI6IjZmNDQzMmRjLTIwZDItNDQxZC1iMWRiLWFjMzM4MGJhNjMzZCIsImMiOjEwfQ%3D%3D"
                            frameborder="0" allowFullScreen="true">
                        </iframe>
                    </div>

                    <p class="text-[#BDBDBD] text-lg sm:text-xl font-light mt-6">
                        Learn more about the project: <a href="https://github.com/sit-2021-int214/033-Customer-Personality-Analysis?tab=readme-ov-file" target="_blank" class="text-[#2F80ED] hover:underline">GitHub</a>
                    </p>


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