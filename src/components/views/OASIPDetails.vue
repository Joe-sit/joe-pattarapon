<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, } from 'vue-router';

import waterMapImg from '../../assets/portfolios/oasip.png'
import externalSVG from '../../assets/arrow-square-out.svg'
import backSVG from '../../assets/arrow-left.svg'
import oImg1 from '../../assets/portfolios/o-1.jpg'
import oImg2 from '../../assets/portfolios/o-2.jpg'
import oImg3 from '../../assets/portfolios/o-3.jpg'
import oImg4 from '../../assets/portfolios/o-4.jpg'
import oImg5 from '../../assets/portfolios/o-5.jpg'
import oImg6 from '../../assets/portfolios/o-6.jpg'
import oImg7 from '../../assets/portfolios/o-7.jpg'
import oImg8 from '../../assets/portfolios/o-8.jpg'
import oImg9 from '../../assets/portfolios/o-9.jpg'
import oImg10 from '../../assets/portfolios/o-10.jpg'
import oImg11 from '../../assets/portfolios/o-11.jpg'
import oImg12 from '../../assets/portfolios/o-12.jpg'
import oImg13 from '../../assets/portfolios/o-13.jpg'
import oImg14 from '../../assets/portfolios/o-14.jpg'






import GoSVG from '../../assets/bubble.svg'
import figmaIcon from '../../assets/figma-icon.svg'
import clickUpIcon from '../../assets/clickup-icon.svg'
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
        portId: 7,
        portName: 'OASIP',
        category: 'Web Dev',
        imgSrc: waterMapImg,
        subTitle: 'IT Integrated Project 2022',
        oImg1: oImg1,
        oImg2: oImg2,
        oImg3: oImg3,
        oImg4: oImg4,
        oImg5: oImg5,
        oImg6: oImg6,
        oImg7: oImg7,
        oImg8: oImg8,
        oImg9: oImg9,
        oImg10: oImg10,
        oImg11: oImg11,
        oImg12: oImg12,
        oImg13: oImg13,
        oImg14: oImg14

    }
])

const portName = ref(data.value[0].portName)
const subTitle = ref(data.value[0].subTitle)
const imgSrc = ref(data.value[0].imgSrc)
const o1 = ref(data.value[0].oImg1)
const o2 = ref(data.value[0].oImg2)
const o3 = ref(data.value[0].oImg3)
const o4 = ref(data.value[0].oImg4)
const o5 = ref(data.value[0].oImg5)
const o6 = ref(data.value[0].oImg6)
const o7 = ref(data.value[0].oImg7)
const o8 = ref(data.value[0].oImg8)
const o9 = ref(data.value[0].oImg9)
const o10 = ref(data.value[0].oImg10)
const o11 = ref(data.value[0].oImg11)
const o12 = ref(data.value[0].oImg12)
const o13 = ref(data.value[0].oImg13)
const o14 = ref(data.value[0].oImg14)

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


const goToGitHub = () => {
    window.open('https://github.com/OASIP-PL-5', '_blank')
}

console.log(subTitle.value);

onMounted(() => {
    window.scrollTo(0, 0);
});

</script>

<template>
    <div>
        <backSVG @click="goToPortfolioPage" class="cursor-pointer mb-4" />
        <!--Title-->
        <h1 class="flex mx-auto font-bold text-2xl sm:text-3xl text-[#2F80ED]">
            {{ portName }}
        </h1>
        <!--Sub Title-->
        <p class="text-[#B5B5B5] mt-2 text-lg sm:text-xl">{{ subTitle }}</p>

        <div>



            <!--Project banner-->
            <img :src="imgSrc" alt="project image" class="w-auto mt-10 mb-6">






            <!--Project Overview section-->
            <div class="w-full grid grid-cols-12 gap-4 mt-6">

                <!-- Overview -->
                <div class="col-span-12 md:col-span-8 bg-white 
                border border-[#B5B5B5] rounded-3xl ">

                    <h1 class="text-[#2F80ED] text-base font-bold mt-6 mx-6 ">Overview</h1>
                    <p class="text-[#1c1c1c] text-lg sm:text-xl mt-4 mx-6 break-words font-light  ">
                        Online Appointment Scheduling System for Integrated Project Clinics (OASIP) is a web application
                        for SIT students who want to consult with lecturers, the system provides facilities for both
                        students and lecturers about scheduling appointments.
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
                                <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap">Figma
                                </span>
                            </div>

                            <div class="flex items-center my-2 py-2 ">
                                <span class="inline-block align-middle mr-2">
                                    <clickUpIcon class="h-6 w-6 fill-[#0D99FF]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap">ClickUp</span>
                            </div>

                            <div class="flex items-center my-2 py-2 ">
                                <span class="inline-block align-middle mr-2">
                                    <vscodeIcon class="h-6 w-6 fill-[#1c1c1c]" />
                                </span>
                                <span class="text-sm sm:text-base text-[#1c1c1c]space-nowrap">Visual Studio Code</span>
                            </div>
                        </div>
                    </div>

                    <div class="mt-6">
                        <!-- More/Method -->
                        <h1 class="text-[#0D99FF] text-base font-bold mx-4">Learn more</h1>
                        <div @click="goToGitHub()"
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
                                    <span class="text-sm sm:text-base text-[#1c1c1c] space-nowrap font-medium">GitHub
                                    </span>

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

                <!-- Modal -->
                <div v-if="isModalOpen"
                    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
                    @click="closeModal">
                    <img :src="currentImage" class="max-w-full max-h-full rounded-lg scale-95 md:scale-110 ">

                </div>


                <div class="mt-10">
                    <h1 class="text-[#2F80ED] text-xl sm:text-2xl font-bold mb-6">Key Features</h1>
                    <h1 class="font-bold text-[#2F80ED] text-lg sm:text-xl mb-4">User Authentication</h1>

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">The implementation includes 2 parts

                        <span class="ml-4 mt-4 block">• In-App login: Users can login using a username and password that
                            exists in the database.</span>
                        <span class="ml-4 mt-4 block">• Microsoft Identity Platform: Users can login via Microsoft with
                            KMUTT email.</span>
                        <span class="mt-4 block">And JWT tokens are used to manage user sessions and handle
                            authorization.</span>

                    </p>

                    <!--Pagination-->

                    <swiper class=" text-[#fff] w-auto mt-6 mb-6 rounded-xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="o1" alt="project image"
                                class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o1)" /></swiper-slide>
                        <swiper-slide><img :src="o2" alt="problem image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o2) " /></swiper-slide>


                    </swiper>

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light ">Users can change their password. If they
                        forget it, the system will send an email with a reset password link.

                    </p>

                    <swiper class=" text-[#fff] w-auto mt-6 mb-6 rounded-xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="o3" alt="project image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o3)" /></swiper-slide>
                        <swiper-slide><img :src="o4" alt="problem image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o4)" /></swiper-slide>
                        <swiper-slide><img :src="o5" alt="problem image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o5)" /></swiper-slide>



                    </swiper>

                    <h1 class="font-bold text-[#2F80ED] text-lg sm:text-xl mb-4">Appointment Scheduling</h1>

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">On event list page, role-based
                        authorization is applied as following roles

                        <span class="ml-4 mt-4 block">• Student users: Can only see and edit their own appointment
                            events.</span>
                        <span class="ml-4 mt-4 block">• Lecturer users: Can only see appointment events they have
                            associated.</span>
                        <span class="ml-4 mt-4 block">• Admin users: Can see and edit all appointment events.</span>

                    </p>

                    <!--Pagination-->

                    <swiper class=" text-[#fff] w-auto mt-6 mb-6 rounded-xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="o6" alt="project image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o6)" /></swiper-slide>
                        <swiper-slide><img :src="o7" alt="problem image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o7)" /></swiper-slide>


                    </swiper>

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light ">Student users can create a new appointment
                        event by fill out all the required fields and the system will send an appointment confirmation
                        email to thier inbox.

                    </p>

                    <swiper class=" text-[#fff] w-auto mt-6 mb-6 rounded-xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="o8" alt="project image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o8)" /></swiper-slide>
                        <swiper-slide><img :src="o9" alt="problem image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o9)" /></swiper-slide>


                    </swiper>

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light ">Student users can edit or delete their own
                        appointment, while admin users can edit or delete any appointment.

                    </p>

                    <img :src="o10" alt="project image" class="w-auto mt-6 mb-6 rounded-x cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o10)">

                    <h1 class="font-bold text-[#2F80ED] text-lg sm:text-xl mb-4">User Management</h1>

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">Admin users have an access to the user list
                        page. Admin users can create/see/edit/delete user account.



                    </p>

                    <!--Pagination-->

                    <swiper class=" text-[#fff] w-auto mt-6 mb-10 rounded-xl" :modules="[Pagination, Navigation]"
                        :pagination="{ type: 'fraction', }" :navigation="true">
                        <swiper-slide><img :src="o11" alt="project image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o11)" /></swiper-slide>
                        <swiper-slide><img :src="o12" alt="problem image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o12)" /></swiper-slide>
                        <swiper-slide><img :src="o13" alt="problem image" class="w-auto cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o13)" /></swiper-slide>

                    </swiper>

                    <h1 class="text-[#2F80ED] text-xl sm:text-2xl font-bold mb-6">System Architecture</h1>

                    <p class="text-[#1c1c1c] text-lg sm:text-xl font-light">OASIP has been built on dockerized SIT
                        infrastructure and developed by using a 3-tier architecture consisting of 3 components.

                        <span class="ml-4 mt-4 block">• Frontend: serves as the User Interface (UI) layer where users
                            can interact with the web app.</span>
                        <span class="ml-4 mt-4 block">• Backend: manages the web app’s logic. It processes requests from
                            the frontend, executes business rules, and handles communication with the database.</span>
                        <span class="ml-4 mt-4 block">• Database: stores and manages all the data of the web app.</span>

                    </p>
                    <img :src="o14" alt="project image" class="w-auto mt-6 mb-6 rounded-xl cursor-pointer duration-500 overflow-hidden hover:scale-105"
                                @click="openModal(o14)">

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