<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, } from 'vue-router';

import ekycImg from '../../assets/portfolios/Ebook2.jpg'

import backSVG from '../../assets/arrow-left.svg'

import hiLightImg1 from '../../assets/portfolios/ck-um-1.jpg'
import hiLightImg2 from '../../assets/portfolios/ck-um-2.jpg'
import hiLightImg3 from '../../assets/portfolios/ck-um-3.jpg'
import hiLightImg4 from '../../assets/portfolios/ck-um-4.jpg'
import hiLightImg5 from '../../assets/portfolios/ck-sm-1.jpg'
import hiLightImg6 from '../../assets/portfolios/ck-sm-2.jpg'
import hiLightImg7 from '../../assets/portfolios/ck-sm-3.jpg'
import hiLightImg8 from '../../assets/portfolios/ck-sm-4.jpg'
import hiLightImg9 from '../../assets/portfolios/ck-re-1.jpg'
import hiLightImg10 from '../../assets/portfolios/ck-wn-1.jpg'
import hiLightImg11 from '../../assets/portfolios/ck-wn-2.jpg'








import GoSVG from '../../assets/bubble.svg'
import figmaIcon from '../../assets/figma-icon.svg'
import heyzineIcon from '../../assets/heyzine-icon.svg'
import scratchIcon from '../../assets/scratch-icon.svg'
import youtubeIcon from '../../assets/youtube-icon.svg'
import bookIcon from '../../assets/book-icon.svg'






import { Swiper, SwiperSlide } from 'swiper/vue';
import { Pagination, Navigation } from 'swiper/modules'


// import { EffectCube } from "swiper/vue"


import 'swiper/swiper-bundle.css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';

// import "swiper/css/effect-cube"

const data = ref([
    {
        portId: 6,
        portName: 'Waste Seperating Game & e-Book',
        category: 'Other',
        imgSrc: ekycImg,
        subTitle: 'The Philosophy of Sufficiency Economy Project 2023',
        hiLightImg1: hiLightImg1,
        hiLightImg2: hiLightImg2,
        hiLightImg3: hiLightImg3,
        hiLightImg4: hiLightImg4,
        hiLightImg5: hiLightImg5,
        hiLightImg6: hiLightImg6,
        hiLightImg7: hiLightImg7,
        hiLightImg8: hiLightImg8,
        hiLightImg9: hiLightImg9,
        hiLightImg10: hiLightImg10,
        hiLightImg11: hiLightImg11,

    }
])

const portName = ref(data.value[0].portName)
const subTitle = ref(data.value[0].subTitle)
const imgSrc = ref(data.value[0].imgSrc)
const hiImg1 = ref(data.value[0].hiLightImg1)
const hiImg2 = ref(data.value[0].hiLightImg2)
const hiImg3 = ref(data.value[0].hiLightImg3)
const hiImg4 = ref(data.value[0].hiLightImg4)
const hiImg5 = ref(data.value[0].hiLightImg5)
const hiImg6 = ref(data.value[0].hiLightImg6)
const hiImg7 = ref(data.value[0].hiLightImg7)
const hiImg8 = ref(data.value[0].hiLightImg8)
const hiImg9 = ref(data.value[0].hiLightImg9)
const hiImg10 = ref(data.value[0].hiLightImg10)
const hiImg11 = ref(data.value[0].hiLightImg11)





const router = useRouter();

const goToPortfolioPage = () => {
    router.push({ name: 'Portfolio' });
}

const goToYouTube = () => {
    window.open('https://youtu.be/NqiicbW3gVs', '_blank')
}

const goToEBook = () => {
    window.open('https://heyzine.com/flip-book/eac3a74d44.html', '_blank')
}

const goToBearTai = () => {
    window.open('https://youtu.be/by9eqSok6g8?si=0R9sGFUV29iktP1S', '_blank')
}







console.log(subTitle.value);

</script>

<template>
    <div>
        <backSVG @click="goToPortfolioPage" class="cursor-pointer mb-4" />
        <!--Title-->
        <h1 class="flex mx-auto font-bold text-2xl sm:text-3xl text-[#0D99FF]">
            {{ portName }}
        </h1>
        <!--Sub Title-->
        <p class="text-[#8A949C] mt-2 text-lg sm:text-xl">{{ subTitle }}</p>

        <div>



            <!--Project banner-->
            <img :src="imgSrc" alt="project image" class="w-auto mt-10 mb-6 rounded-xl">






            <div class="w-full grid grid-cols-12 gap-4 mt-6">

                <!-- Overview -->
                <div class="col-span-12 md:col-span-8 bg-white
border border-[#B5B5B5] rounded-3xl flex flex-col justify-between">

                    <div>
                        <h1 class="text-[#0D99FF] text-base font-bold mt-6 mx-6">Overview</h1>
                        <p class="text-[#1c1c1c] text-lg sm:text-xl mt-4 mx-6 break-words font-light">
                            Goal of this project is to educate children on waste separating through an interactive
                            Scratch-based game and an informative e-book, which also promotes environmental awareness
                            and
                            responsibility.
                        </p>
                    </div>

                    <div class="flex justify-end mx-6 mb-6 mt-4 ">
                        <a href="https://heyzine.com/flip-book/eac3a74d44.html/" target="_blank" class="flex items-center text-white bg-[#0D99FF] my-2 rounded-3xl 
                            px-4 py-2 transition-colors duration-300 ease-in-out hover:bg-[#055c9b] ">
                            Read e-Book
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
                                    <figmaIcon class="h-6 w-6 fill-[#0D99FF]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap">Figma +
                                    FigJam</span>
                            </div>

                            <div class="flex items-center my-2 py-2 ">
                                <span class="inline-block align-middle mr-2">
                                    <scratchIcon class="h-6 w-6 fill-[#0D99FF]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap">Scratch</span>
                            </div>

                            <div class="flex items-center my-2 py-2 ">
                                <span class="inline-block align-middle mr-2">
                                    <heyzineIcon class="h-6 w-6 fill-[#1c1c1c]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c]space-nowrap">Heyzine</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6">
                        <!-- More/Method -->
                        <h1 class="text-[#0D99FF] text-base font-bold mx-4">Learn more</h1>
                        <div @click="goToYouTube()"
                            class="mt-4 mx-4 mb-4 cursor-pointer rounded-xl transition-colors duration-300 ease-in-out hover:bg-blue-50 ">
                            <div class="">
                                <div class="flex items-center px-3 py-2  ">
                                    <span class="inline-block align-middle mr-2">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                            xmlns="http://www.w3.org/2000/svg">
                                            <path
                                                d="M2 10C2 7.17157 2 5.75736 2.87868 4.87868C3.75736 4 5.17157 4 8 4H11C13.8284 4 15.2426 4 16.1213 4.87868C17 5.75736 17 7.17157 17 10V14C17 16.8284 17 18.2426 16.1213 19.1213C15.2426 20 13.8284 20 11 20H8C5.17157 20 3.75736 20 2.87868 19.1213C2 18.2426 2 16.8284 2 14V10Z"
                                                stroke="black" stroke-width="2" class="my-path"></path>
                                            <path
                                                d="M18.8531 8.20273L17 9.49989V15.4999L18.8531 16.797C20.2334 17.7633 20.9236 18.2464 21.4618 17.9662C22 17.686 22 16.8435 22 15.1586V9.8412C22 8.15625 22 7.31377 21.4618 7.03356C20.9236 6.75335 20.2334 7.23648 18.8531 8.20273Z"
                                                stroke="black" stroke-width="2" stroke-linecap="round" class="my-path">
                                            </path>
                                        </svg>
                                    </span>
                                    <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap font-medium">Youtube Video</span>

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
                                        class="text-sm sm:text-base text-[#1c1c1c] [#F04E23] space-nowrap font-medium">e-Book
                                        </span>

                                </div>
                            </div>
                        </div> -->
                    </div>
                </div>
            </div>


            <!--Description-->

            <div>

                <!--Background-->
                <div class="mt-10">
                    <h1 class="text-[#0D99FF] text-xl sm:text-2xl font-bold mb-6">Background</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light mb-4">This project was inspired by a <span
                            @click="goToBearTai()" class="text-[#0D99FF] cursor-pointer hover:underline">Beartai</span>
                        channel video where Governor Chadchart visited local communities to see how they handle waste.
                        The video highlighted the big environmental and economic problems caused by not separating waste
                        properly.</p>

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">Motivated by this, I created a fun
                        Scratch-based game and an easy tounderstand e-book to teach kids about waste separation. By
                        learning to sort wet and dry waste, we hope to encourage better waste management and improve
                        recycling, helping make our city more sustainable.</p>
                </div>

                <!--Output-->
                <div class="mt-10">
                    <h1 class="text-[#0D99FF] text-xl sm:text-2xl font-bold mb-6">Output</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light"> This project has two main outputs: an
                        e-book and a Scratch-based game.
                        <span class="ml-4 mt-4 block">• E-book: An informative guide on waste separation for
                            children.</span>
                        <span class="ml-4 mt-4 block">• Scratch Game: An interactive game that teaches kids how to
                            properly sort waste.</span>
                        <span class="block mt-4"> You can also watch a YouTube video that explains both the e-book and
                            the game in detail.
                        </span>

                    </p>


                </div>


                <div class="mt-6 rounded-xl">


                    <iframe class="flex mx-auto w-full h-[550px]"
                        src="https://www.youtube.com/embed/NqiicbW3gVs?si=g1qIa6fCoLkiG5pv" title="YouTube video player"
                        frameborder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>

                </div>

                <!--Go next-->
                <div class="mt-10">
                    <h1 class="text-[#0D99FF] text-lg sm:text-xl font-bold mb-6">Where should I go next?</h1>
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