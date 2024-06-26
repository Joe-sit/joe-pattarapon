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
        <h1 class="flex mx-auto font-bold text-4xl sm:text-3xl text-[#F2F2F2]">
            {{ portName }}
        </h1>
        <!--Sub Title-->
        <p class="text-[#8A949C] mt-2 text-2xl sm:text-xl">{{ subTitle }}</p>

        <div>



            <!--Project banner-->
            <img :src="imgSrc" alt="project image" class="w-auto mt-10 mb-6 rounded-xl">






            <div class="w-full grid grid-cols-12 gap-4 mt-6">

                <!-- Overview -->
                <div class="col-span-12 md:col-span-8 bg-[#101010] 
    border border-[#ffffff]/5 rounded-xl flex flex-col justify-between">

                    <div>
                        <h1 class="text-[#8A949C] text-base font-medium mt-6 mx-6">Overview</h1>
                        <p class="text-[#F2F2F2] text-xl sm:text-lg mt-4 mx-6 break-words font-light">
                            Goal of this project is to educate children on waste separating through an interactive
                            Scratch-based game and an informative e-book, which also promotes environmental awareness
                            and
                            responsibility.
                        </p>
                    </div>

                    <div class="flex justify-end mx-6 mb-6 mt-4">
                        <a href="https://heyzine.com/flip-book/eac3a74d44.html" target="_blank" class="flex text-white bg-[#141414] my-2 rounded-xl px-3 py-3 
            transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F] border border-[#ffffff]/5">
                            Read e-Book
                            <GoSVG class="ml-2 inline-block fill-white w-6 h-6" viewBox="0 0 40 40" />
                        </a>
                    </div>
                </div>

                <!-- Right column -->
                <div class="col-span-12 md:col-span-4 bg-[#101010] mt-2 sm:mt-0
    border border-[#ffffff]/5 rounded-xl px-2 py-2">

                    <!-- Tools -->
                    <h1 class="text-[#8A949C] text-base font-medium mt-4 mx-4">Tools</h1>
                    <div class="w-full mt-4 mx-4">
                        <div class="flex flex-wrap gap-2">
                            <div class="flex items-center px-3 py-2 border border-[#ffffff]/5 rounded-full">
                                <span class="inline-block align-middle mr-2">
                                    <figmaIcon class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-base sm:text-sm text-white whitespace-nowrap">Figma + FigJam</span>
                            </div>

                            <div class="flex items-center px-3 py-2 border border-[#ffffff]/5 rounded-full">
                                <span class="inline-block align-middle mr-2">
                                    <scratchIcon class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-base sm:text-sm text-white whitespace-nowrap">Scratch</span>
                            </div>

                            <div class="flex items-center px-3 py-2 border border-[#ffffff]/5 rounded-full">
                                <span class="inline-block align-middle mr-2">
                                    <heyzineIcon class="h-6 w-6 fill-white" />
                                </span>
                                <span class="text-base sm:text-sm text-white whitespace-nowrap">Heyzine</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6">
                        <!-- More/Method -->
                        <h1 class="text-[#8A949C] text-base font-medium mx-4">More</h1>
                        <div class="w-full mt-4 mx-4 mb-6">
                            <div class="flex flex-wrap gap-2">
                                <div @click="goToYouTube()" class="flex items-center px-3 py-2 cursor-pointer transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]
                    border border-[#ffffff]/5 rounded-full">
                                    <span class="inline-block align-middle mr-2">
                                        <youtubeIcon class="h-6 w-6 fill-white" />
                                    </span>
                                    <span class="text-base sm:text-sm text-white whitespace-nowrap">YouTube</span>
                                    <GoSVG class="ml-2 inline-block fill-white w-6 h-6" viewBox="0 0 40 40" />
                                </div>
                                <div @click="goToEBook()" class="flex items-center px-3 py-2 cursor-pointer transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]
                    border border-[#ffffff]/5 rounded-full">
                                    <span class="inline-block align-middle mr-2">
                                        <bookIcon class="h-6 w-6 fill-white" />
                                    </span>
                                    <span class="text-base sm:text-sm text-white whitespace-nowrap">e-Book</span>
                                    <GoSVG class="ml-2 inline-block fill-white w-6 h-6" viewBox="0 0 40 40" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>


            <!--Description-->

            <div>

                <!--Background-->
                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Background</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light mb-4">This project was inspired by a <span
                            @click="goToBearTai()" class="text-[#0D99FF] cursor-pointer hover:underline">Beartai</span>
                        channel video where Governor Chadchart visited local communities to see how they handle waste.
                        The video highlighted the big environmental and economic problems caused by not separating waste
                        properly.</p>

                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light">Motivated by this, I created a fun
                        Scratch-based game and an easy tounderstand e-book to teach kids about waste separation. By
                        learning to sort wet and dry waste, we hope to encourage better waste management and improve
                        recycling, helping make our city more sustainable.</p>
                </div>

                <!--Output-->
                <div class="mt-10">
                    <h1 class="text-white text-3xl sm:text-2xl font-medium mb-6">Output</h1>
                    <p class="text-[#BDBDBD] text-2xl sm:text-xl font-light"> This project has two main outputs: an
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