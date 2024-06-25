<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, } from 'vue-router';

import ekycImg from '../../assets/portfolios/abcWishYourGrade.png'

import backSVG from '../../assets/arrow-left.svg'

import hiLightImg1 from '../../assets/portfolios/abc-1.jpg'
import hiLightImg2 from '../../assets/portfolios/abc-2.jpg'
import hiLightImg3 from '../../assets/portfolios/abc-3.jpg'









import GoSVG from '../../assets/bubble.svg'
import figmaIcon from '../../assets/figma-icon.svg'
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
        portId: 8,
        portName: 'ABCWishYourGrade',
        category: 'Web Dev',
        imgSrc: ekycImg,
        subTitle: 'Client-side Web Programming 2022',
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

const goToGitHub = () => {
    window.open('https://github.com/Joe-sit/INT203-Group-Project', '_blank')
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
                        ABCWishYourGrade is a grade calculator web app built with Vue.js for functionality and styled
                        with Tailwind CSS.
                    </p>

                    <div class="flex justify-end mx-6 mb-6 mt-4 ">
                        <a href="https://nifty-carson-febb17.netlify.app/" target="_blank" class="flex text-white bg-[#141414] my-2 rounded-xl px-3 py-3 
                            transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F] border border-[#ffffff]/5">
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
                                <span class="text-base sm:text-sm text-white whitespace-nowrap">Figma</span>
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
                        <div @click="goToGitHub()" class="w-full mt-4 mx-4 mb-6 ">
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
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Introduction</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">This website helps you evaluate and plan
                        your grades. The idea came from those times when we wonder or hope what our grades will be right
                        before they're released. So, we created the grade calculator web app ABCWishYourGrade.</p>
                </div>

                <!--Responsibilities as Intern-->
                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">How to use</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">

                        Try it out at: <a href="https://nifty-carson-febb17.netlify.app/"
                            class="text-[#0D99FF] hover:underline"
                            target="_blank">https://nifty-carson-febb17.netlify.app/</a>
                        <span class="ml-4 mt-4 block">• Upon entering, you'll see a form where users can input their
                            information.</span>
                        <span class="ml-4 mt-4 block">• You can enter:
                            <span class="ml-6 mt-4 block">• Course names</span>
                            <span class="ml-6 mt-4 block">• Grade levels</span>
                            <span class="ml-6 mt-4 block">• Credit for each course</span>
                        </span>
                        <span class="ml-4 mt-4 block">• The results section below displays:
                            <span class="ml-6 mt-4 block">• Basic information about GPA</span>
                            <span class="ml-6 mt-4 block">• Definition of GPA</span>
                            <span class="ml-6 mt-4 block">• How GPA is calculated</span>
                        </span>
                        <span class="ml-4 mt-4 block">• GPA levels are displayed differently:
                            <span class="ml-6 mt-4 block">• If GPA is above 3.50, the background color will be
                                green.</span>
                        </span>
                        <span class="ml-4 mt-4 block">• GPA calculations are in real-time:
                            <span class="ml-6 mt-4 block">• Users can adjust grades or credit , and the GPA will update
                                accordingly.</span>
                        </span>
                    </p>
                </div>

                <!--Pagination-->

                <swiper class=" text-white w-auto mt-6 mb-6 rounded-xl" :modules="[Pagination, Navigation]"
                    :pagination="{ type: 'fraction', }" :navigation="true">
                    <swiper-slide><img :src="hiImg1" alt="project image" class="w-auto" /></swiper-slide>
                    <swiper-slide><img :src="hiImg2" alt="problem image" class="w-auto" /></swiper-slide>
                    <swiper-slide><img :src="hiImg3" alt="problem image" class="w-auto" /></swiper-slide>

                </swiper>


                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Guideline</h1>

                    <span class="ml-4 mt-4 block text-[#BDBDBD] text-2xl sm:text-xl font-light">• Users can add more
                        rows for additional courses by clicking the blue
                        button with a plus icon. </span>
                    <span class="ml-4 mt-4 block text-[#BDBDBD] text-2xl sm:text-xl font-light">• Users can clear all
                        entered data by clicking the gray button with a
                        cross icon.</span>





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