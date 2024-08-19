<script setup>
import { ref, onMounted } from 'vue'
import EmailSVG from '../../assets/email_svgrepo.com.svg'
import PhoneSVG from '../../assets/phone.svg'
import ClipBoardSVG from '../../assets/select_window_2.svg'
import CheckSVG from '../../assets/check.svg'
import LinkedInSVG from '../../assets/linkedin_svgrepo.com.svg'
import InstagramSVG from '../../assets/instagram_svgrepo.com.svg'
import ResumeSVG from '../../assets/read-cv-logo-fill.svg'
import TranscriptSVG from '../../assets/transcript-fill.svg'
import GoSVG from '../../assets/bubble.svg'
import StackSVG from '../../assets/stack.svg'
import FigmaSVG from '../../assets/figma-color.svg'
import MondaySVG from '../../assets/monday-color.svg'
import VSCodeSVG from '../../assets/vs-code-color.svg'
import GitHubSVG from '../../assets/github-142_svgrepo.com.svg'
import CrownSVG from '../../assets/CrownSimple.svg'
import GoBlueSVG from '../../assets/bubble-blue.svg'




import { Swiper, SwiperSlide } from 'swiper/vue';
import { Pagination, Navigation } from 'swiper/modules'


// import { EffectCube } from "swiper/vue"


import 'swiper/swiper-bundle.css';
import 'swiper/css/pagination';
import 'swiper/css/navigation';



const goToLinkedIn = () => {
    window.open('https://www.linkedin.com/in/pattarapon-makhirun-a06011214/', '_blank')
}

const goToInstagram = () => {
    window.open('https://www.instagram.com/joe_autismxd/', '_blank')

}

const goToTranscript = () => {
    window.open('https://drive.google.com/file/d/1BVSDuNsfsuXhzVb81vYbGIh2kcZ9mDRe/view?usp=sharing', '_blank')
}

const goToCertificate = () => {
    window.open('https://drive.google.com/file/d/11clYchCGe03cF3zM2HH_-TOpcY4e0D_y/view?usp=sharing', '_blank')
}

const goToResume = () => {
    window.open('https://drive.google.com/file/d/1SgMjbau41IQnFTFTtOqEB5kRY4zNPF6E/view?usp=sharing', '_blank')
}

onMounted(() => {
    window.scrollTo(0, 0);
});

const email = ref('pattarapon.mak@gmail.com');
const isCopied = ref(false);

const copyEmail = () => {
    navigator.clipboard.writeText(email.value)
        .then(() => {
            console.log('Email copied to clipboard');
            isCopied.value = true; // Update state to indicate email has been copied
            setTimeout(() => {
                isCopied.value = false; // Reset the state after a short delay
            }, 2000); // Reset to default state after 2 seconds (adjust as needed)
        })
        .catch(err => {
            console.error('Failed to copy email: ', err);
        });
}

</script>

<template>
    <div class="fade-in-up mx-auto max-w-screen-lg min-h-screen mb-6  ">
        <!-- About Section (NEW) -->
        <div class="text-white min-h-screen flex flex-col items-center py-6 ">
            <div class="max-w-screen-lg w-full px-4">
                <!-- Grid Layout -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mx-2">
                    <!-- Image Section -->
                    <div class="col-span-1 md:col-span-4 flex justify-center items-center">
                        <img src="../../assets/joe-pic-new.jpg" class="object-cover w-full h-full rounded-3xl"
                            alt="Profile Picture" />
                    </div>
                    <!-- Profile Info Section -->
                    <div class="col-span-1 md:col-span-8 flex flex-col">

                        <!-- About Section -->
                        <div class="bg-gradient-to-br from-white via-slate-50 to-orange-200 border 
                        rounded-3xl p-4 text-[#1c1c1c] h-full">
                            <h1 class="font-bold text-base sm:text-base mb-4 ">About me</h1>
                            <p class="text-sm sm:text-lg font-normal break-keep ">
                                Hey there! I’m Pattarapon Makhirun, but you can call me Joe. I was born and raised in
                                Bangkok, Thailand. From a young age, I've been passionate about visual design and
                                technology. I love merging creativity with practical solutions, which led me to study
                                Information Technology (IT) and take on a UX/UI design internship.
                            </p>

                            <p class="text-sm sm:text-lg font-normal break-keep mt-4">
                                In my free time, I enjoy practicing piano and discovering new Jazz and J-Pop songs to
                                cover. While I'm not a fan of going outside much, you can often find me at cafes
                                enjoying my love for coffee.
                            </p>
                        </div>
                    </div>
                </div>


                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mx-2 ">

                    <div
                        class="text-[#1c1c1c] col-span-1 rounded-3xl bg-gradient-to-tr from-white via-slate-50 to-blue-200 border ">
                        <h1 class="font-bold text-sm sm:text-base mx-6 mt-6 mb-4">Education</h1>

                        <!-- KMUTT -->
                        <div class="mx-6 mb-6">
                            <p class="text-sm sm:text-lg  mb-2">2020 - 2024</p>
                            <p class="text-sm sm:text-lg font-medium mb-2">King Mongkut’s University of Technology
                                Thonburi (KMUTT)</p>
                            <div class="flex items-center justify-between">
                                <p class="text-sm sm:text-lg ">B.Sc. Information Technology</p>
                                <span class="bg-white text-sm sm:text-base border rounded-lg px-1">GPAX
                                    3.58</span>
                            </div>
                        </div>

                        <!-- SKT -->
                        <div class="mx-6 mb-6">
                            <p class="text-sm sm:text-lg  mb-2">2014 - 2020</p>
                            <p class="text-sm sm:text-lg font-medium mb-2">Suankularb Wittayalai Thonburi (SKT)</p>
                            <div class="flex items-center justify-between">
                                <p class="text-sm sm:text-lg ">English-Mathematics Program</p>
                                <span class="bg-white text-sm sm:text-base border rounded-lg px-1">GPAX
                                    3.68</span>
                            </div>
                        </div>
                    </div>


                    <!-- My stacks -->
                    <div
                        class="text-[#1c1c1c] col-span-1 rounded-3xl bg-gradient-to-bl from-white via-slate-50 to-green-200 border max-h-full ">
                        <div>
                            <h1 class="font-bold text-sm sm:text-base mx-6 mt-6">My stacks</h1>

                            <!-- Stacks -->
                            <div class="grid mt-4 mx-6 text-[#1c1c1c]">

                                <div class="border flex items-center w-full 
                                    px-4 py-4 rounded-xl bg-white font-medium text-sm sm:text-lg mb-4">
                                    <FigmaSVG class="mr-2" />Figma
                                    <!-- Stacks description -->
                                    <p class="ml-auto text-base hidden sm:block ">Design Tools</p>
                                </div>

                                <div class="border flex items-center  w-full
                                     px-4 py-4 rounded-xl bg-white font-medium text-sm sm:text-lg mb-4">
                                    <MondaySVG class="mr-2" />Monday
                                    <p class="ml-auto text-base hidden sm:block">Project Management</p>
                                </div>

                                <div class="border flex items-center  border-[#ffffff]/5 w-full 
                                    px-4 py-4 rounded-xl bg-white font-medium text-sm sm:text-lg mb-4">
                                    <VSCodeSVG class="mr-2" />Visual Studio Code
                                    <p class="ml-auto text-base hidden sm:block">Code Editor</p>
                                </div>

                                <div class="border flex items-center  border-[#ffffff]/5 w-full
                                     px-4 py-4 rounded-xl bg-white font-medium text-sm sm:text-lg mb-4">
                                    <GitHubSVG class="mr-2 " />GitHub
                                    <p class="ml-auto text-base hidden sm:block">Version Control</p>
                                </div>

                            </div>
                        </div>
                    </div>

                </div>

                <!-- Explore Section -->
                <div class="grid grid-cols-12 gap-4 mt-4 mx-2">

                    <router-link :to="{ name: 'Portfolio' }" class="bg-white border border-[#2F80ED] rounded-3xl
                    col-span-8 md:col-span-10 flex justify-center items-center
                    transition-colors duration-500 ease-in-out hover:bg-[#2F80ED] group">
                        <div
                            class="flex items-center gap-x-2 justify-center text-sm md:text-4xl font-bold py-12 text-center">
                            <h1
                                class="py-2 text-[#2F80ED] group-hover:text-white transition-colors duration-500 ease-in-out">
                                Explore my interesting works</h1>

                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                                xmlns="http://www.w3.org/2000/svg" class="my-path">
                                <path d="M9.00378 5.99561L15.004 11.9959L9.00024 17.9996" stroke="#2f80ed"
                                    stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                    class="group-hover:stroke-white transition-colors duration-500 ease-in-out" />
                            </svg>
                        </div>
                    </router-link>

                    <!-- Count Works -->
                    <div class="bg-[#F04E23] border border-[#F04E23]/5 rounded-3xl 
                        col-span-4 md:col-span-2 flex flex-col justify-center items-center">
                        <h1 class="text-4xl md:text-6xl py-2
                            font-bold text-white">
                            10+
                        </h1>
                        <div
                            class="flex items-center px-2 py-1 bg-white border border-[#ffffff]/5 rounded-full mb-2 sm:mb-0">
                            <span class="inline-block align-middle mr-2">
                                <StackSVG class="h-4 w-4" />
                            </span>
                            <span class="text-xs sm:text-sm text-[#F04E23] whitespace-nowrap">
                                Works
                            </span>
                        </div>
                    </div>

                </div>


            </div>




            <div class="max-w-screen-lg w-full px-4">
                <!-- Projects and Contact Section -->
                <div class="grid grid-cols-12 md:grid-cols-12 gap-4 mt-4 mx-2  ">

                    <!-- Contact -->
                    <div class="col-span-12 md:col-span-5 rounded-3xl bg-gradient-to-br from-white via-slate-50 to-orange-200
    border    ">
                        <div>
                            <h1 class="font-bold text-sm sm:text-base text-[#1c1c1c] mx-6 mt-6">Documents</h1>

                            <!-- Basic Contacts Info. -->
                            <div class="grid mt-4 mx-6 text-[#1c1c1c]">
                                <button @click="goToResume" class="flex justify-start items-center transition-colors duration-500 ease-in-out 
                hover:bg-orange-400 hover:text-white
                border w-full px-4 py-4 rounded-xl bg-white font-medium text-base mb-4">

                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor"
                                        class="mr-2 transition-colors duration-500 ease-in-out svg-icon"
                                        viewBox="0 0 256 256">
                                        <path
                                            d="M210.78,39.25l-130.25-23A16,16,0,0,0,62,29.23l-29.75,169a16,16,0,0,0,13,18.53l130.25,23a16,16,0,0,0,18.54-13l29.75-169A16,16,0,0,0,210.78,39.25ZM135.5,131.56a8,8,0,0,1-7.87,6.61,8.27,8.27,0,0,1-1.4-.12l-41.5-7.33A8,8,0,0,1,87.52,115L129,122.29A8,8,0,0,1,135.5,131.56Zm47-24.18a8,8,0,0,1-7.86,6.61,7.55,7.55,0,0,1-1.41-.13l-83-14.65a8,8,0,0,1,2.79-15.76l83,14.66A8,8,0,0,1,182.53,107.38Zm5.55-31.52a8,8,0,0,1-7.87,6.61,8.36,8.36,0,0,1-1.4-.12l-83-14.66a8,8,0,1,1,2.78-15.75l83,14.65A8,8,0,0,1,188.08,75.86Z">
                                        </path>
                                    </svg>

                                    Resume
                                </button>
                                <button @click="goToTranscript" class="flex justify-start items-center transition-colors duration-500 ease-in-out 
                hover:bg-orange-400 hover:text-white
                border w-full px-4 py-4 rounded-xl bg-white font-medium text-base mb-4">

                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor"
                                        class="mr-2 transition-colors duration-500 ease-in-out svg-icon"
                                        viewBox="0 0 256 256">
                                        <path
                                            d="M226.53,56.41l-96-32a8,8,0,0,0-5.06,0l-96,32A8,8,0,0,0,24,64v80a8,8,0,0,0,16,0V75.1L73.59,86.29a64,64,0,0,0,20.65,88.05c-18,7.06-33.56,19.83-44.94,37.29a8,8,0,1,0,13.4,8.74C77.77,197.25,101.57,184,128,184s50.23,13.25,65.3,36.37a8,8,0,0,0,13.4-8.74c-11.38-17.46-27-30.23-44.94-37.29a64,64,0,0,0,20.65-88l44.12-14.7a8,8,0,0,0,0-15.18ZM176,120A48,48,0,1,1,89.35,91.55l36.12,12a8,8,0,0,0,5.06,0l36.12-12A47.89,47.89,0,0,1,176,120Z">
                                        </path>
                                    </svg>

                                    Transcript
                                </button>
                                <button @click="goToCertificate" class="flex justify-start items-center transition-colors duration-500 ease-in-out 
                hover:bg-orange-400 hover:text-white
                border w-full px-4 py-4 rounded-xl bg-white font-medium text-base mb-4">

                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor"
                                        class="mr-2 transition-colors duration-500 ease-in-out svg-icon"
                                        viewBox="0 0 256 256">
                                        <path
                                            d="M232,86.53V56a16,16,0,0,0-16-16H40A16,16,0,0,0,24,56V184a16,16,0,0,0,16,16H160v24A8,8,0,0,0,172,231l24-13.74L220,231A8,8,0,0,0,232,224V161.47a51.88,51.88,0,0,0,0-74.94ZM128,144H72a8,8,0,0,1,0-16h56a8,8,0,0,1,0,16Zm0-32H72a8,8,0,0,1,0-16h56a8,8,0,0,1,0,16Zm88,98.21-16-9.16a8,8,0,0,0-7.94,0l-16,9.16V172a51.88,51.88,0,0,0,40,0ZM196,160a36,36,0,1,1,36-36A36,36,0,0,1,196,160Z">
                                        </path>
                                    </svg>

                                    Degree Certificate
                                </button>
                            </div>
                        </div>
                    </div>





                    <div class="col-span-12 md:col-span-4 rounded-3xl  border ">


                        <!--Pagination-->

                        <swiper class="rounded-3xl object-contain " :modules="[Pagination]" :pagination="true">
                            <swiper-slide>
                                <img src="../../assets/hobby-coffee-1.jpg" alt="project image"
                                    class="w-full h-full object-fill" />
                            </swiper-slide>
                            <swiper-slide>
                                <img src="../../assets/hobby-coffee-2.jpg" alt="project image"
                                    class="w-full h-full object-fill" />
                            </swiper-slide>
                            <swiper-slide>
                                <img src="../../assets/hobby-eat-1.jpg" alt="project image"
                                    class="w-full h-full object-fill" />
                            </swiper-slide>
                            <swiper-slide>
                                <img src="../../assets/hobby-eat-2.jpg" alt="project image"
                                    class="w-full h-full object-fill" />
                            </swiper-slide>
                            <swiper-slide>
                                <img src="../../assets/hobby-piano-1.jpg" alt="project image"
                                    class="w-full h-full object-fill" />
                            </swiper-slide>

                        </swiper>


                    </div>

                    <!-- Documents -->
                    <div
                        class="col-span-12 md:col-span-3 rounded-3xl bg-white border border-[#DD7CFF] max-h-full p-6 flex flex-col items-center text-center">
                        <div class="mb-4">
                            <CrownSVG class="mx-auto" />
                        </div>
                        <h1 class="text-[#1c1c1c] font-medium text-lg mb-6">Let’s get to know each other better</h1>

                        <!-- Copy email button -->
                        <div class="w-full">


                            <button v-if="!isCopied" @click="copyEmail"
                                class="flex items-center justify-center w-full text-white bg-[#E9AAFF] rounded-xl px-4 py-4 transition-colors duration-500 ease-in-out hover:bg-[#86439e]">
                                Copy email<span class="ml-2">
                                    <ClipBoardSVG />
                                </span>
                            </button>
                            <button v-else
                                class="flex items-center justify-center w-full text-white bg-[#E9AAFF] rounded-xl px-4 py-4 transition-colors duration-500 ease-in-out hover:bg-[#86439e]">
                                Copied<span class="ml-2">
                                    <CheckSVG />
                                </span>
                            </button>
                        </div>
                    </div>

                </div>

                <div class="mx-4 md:mx-2 mt-4">
                    <div
                        class="relative bg-gradient-to-bl from-white via-slate-50 to-orange-200 border rounded-3xl px-6 py-6 h-full">




                        <div class="flex justify-between">

                            <p class="text-base sm:text-3xl font-bold break-keep text-[#1C1C1C] max-w-[400px]">
                                Let's Work Together
                            </p>



                        </div>


                        <p class="text-[#1C1C1C] text-sm sm:text-lg my-6 max-w-[580px]">Reach me out for a further
                            collaborations.</p>

                        <!-- Email -->
                        <div class="flex flex-col mt-4">
                            <div class="flex items-center gap-x-2">
                                <svg class="w-4 h-4 md:w-6 md:h-6" width="24" height="24" viewBox="0 0 24 24"
                                    fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path
                                        d="M3 12C3 8.22876 3 6.34315 4.17157 5.17157C5.34315 4 7.22876 4 11 4H13C16.7712 4 18.6569 4 19.8284 5.17157C21 6.34315 21 8.22876 21 12C21 15.7712 21 17.6569 19.8284 18.8284C18.6569 20 16.7712 20 13 20H11C7.22876 20 5.34315 20 4.17157 18.8284C3 17.6569 3 15.7712 3 12Z"
                                        stroke="#1c1c1c" stroke-width="2" class="my-path"></path>
                                    <path
                                        d="M3.54883 6.73307L7.76733 9.36198C9.82587 10.6448 10.8551 11.2863 11.9998 11.2861C13.1445 11.2859 14.1736 10.6441 16.2317 9.36063L20.461 6.72314"
                                        stroke="#1c1c1c" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                                        class="my-path"></path>
                                </svg>
                                <!-- <EmailSVG class="my-auto mr-4" /> -->
                                <a href="mailto:pattarapon.mak@gmail.com" class="email-address  
                                    text-[#1C1C1C] break-words text-sm sm:text-lg font-medium">
                                    pattarapon.mak@gmail.com
                                </a>
                            </div>
                        </div>

                        <!-- Phone -->
                        <div class="flex mt-4 items-center gap-x-2 mb-10">
                            <svg class="w-4 h-4 md:w-6 md:h-6" width="24" height="24" viewBox="0 0 24 24" fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <path
                                    d="M6.02427 10.2591L13.7368 17.9716C15.4072 19.642 18.1154 19.642 19.7858 17.9716C20.4539 17.3035 20.4539 16.2202 19.7858 15.552L17.6434 13.4096C17.1562 12.9224 16.3663 12.9224 15.8791 13.4096C15.3919 13.8968 14.602 13.8968 14.1148 13.4096L10.2334 9.52819C9.74619 9.041 9.74619 8.25109 10.2334 7.7639C10.7206 7.2767 10.7206 6.4868 10.2334 5.9996L8.44388 4.2101C7.77573 3.54195 6.69243 3.54194 6.02428 4.2101C4.35389 5.88049 4.35389 8.58872 6.02427 10.2591Z"
                                    stroke="#1c1c1c" stroke-width="2" class="my-path"></path>
                            </svg>
                            <!-- <PhoneSVG class="my-auto mr-4" /> -->
                            <p class="text-sm sm:text-lg text-[#1C1C1C] break-words font-medium ">(+66) 61-786-1777
                            </p>
                        </div>





                        <!-- Go to About Page -->
                        <div class="flex gap-x-6 my-2">
                            <a href="mailto:pattarapon.mak@gmail.com"
                                class="bg-[#1C1C1C] text-white 
                            text-sm sm:text-base font-bold px-6 flex items-center rounded-full transition-all duration-500 hover:-translate-y-2">Contact
                                me</a>



                            <!--LinkedIn button-->
                            <button @click="goToLinkedIn()"
                                class="w-10 h-10  flex items-center relative overflow-hidden justify-center rounded-full bg-white  group transition-all duration-300">
                                <svg class="fill-gray-900 relative z-10 transition-all duration-300 group-hover:fill-white"
                                    xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 72 72"
                                    fill="none">
                                    <path
                                        d="M24.7612 55.999V28.3354H15.5433V55.999H24.7621H24.7612ZM20.1542 24.5591C23.3679 24.5591 25.3687 22.4348 25.3687 19.7801C25.3086 17.065 23.3679 15 20.2153 15C17.0605 15 15 17.065 15 19.7799C15 22.4346 17.0001 24.5588 20.0938 24.5588H20.1534L20.1542 24.5591ZM29.8633 55.999H39.0805V40.5521C39.0805 39.7264 39.1406 38.8985 39.3841 38.3088C40.0502 36.6562 41.5668 34.9455 44.1138 34.9455C47.4484 34.9455 48.7831 37.4821 48.7831 41.2014V55.999H58V40.1376C58 31.6408 53.4532 27.6869 47.3887 27.6869C42.4167 27.6869 40.233 30.4589 39.0198 32.347H39.0812V28.3364H29.8638C29.9841 30.9316 29.8631 56 29.8631 56L29.8633 55.999Z"
                                        fill="" />
                                </svg>
                                <div
                                    class="absolute top-full left-0 w-full h-full rounded-full bg-[#006699] z-0 transition-all duration-500 group-hover:top-0">
                                </div>
                            </button>

                            <!--Instagram button-->
                            <button @click="goToInstagram()"
                                class="w-10 h-10 flex items-center justify-center rounded-full relative overflow-hidden bg-white  group transition-all duration-500">
                                <svg class="fill-gray-900 relative z-10 transition-all duration-500 group-hover:fill-white"
                                    xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 51 51"
                                    fill="none">
                                    <path
                                        d="M17.4456 25.7808C17.4456 21.1786 21.1776 17.4468 25.7826 17.4468C30.3875 17.4468 34.1216 21.1786 34.1216 25.7808C34.1216 30.383 30.3875 34.1148 25.7826 34.1148C21.1776 34.1148 17.4456 30.383 17.4456 25.7808ZM12.9377 25.7808C12.9377 32.8708 18.6883 38.618 25.7826 38.618C32.8768 38.618 38.6275 32.8708 38.6275 25.7808C38.6275 18.6908 32.8768 12.9436 25.7826 12.9436C18.6883 12.9436 12.9377 18.6908 12.9377 25.7808ZM36.1342 12.4346C36.1339 13.0279 36.3098 13.608 36.6394 14.1015C36.9691 14.595 37.4377 14.9797 37.9861 15.2069C38.5346 15.4342 39.1381 15.4939 39.7204 15.3784C40.3028 15.2628 40.8378 14.9773 41.2577 14.5579C41.6777 14.1385 41.9638 13.6041 42.0799 13.0222C42.1959 12.4403 42.1367 11.8371 41.9097 11.2888C41.6828 10.7406 41.2982 10.2719 40.8047 9.94202C40.3112 9.61218 39.7309 9.436 39.1372 9.43576H39.136C38.3402 9.43613 37.5771 9.75216 37.0142 10.3144C36.4514 10.8767 36.1349 11.6392 36.1342 12.4346ZM15.6765 46.1302C13.2377 46.0192 11.9121 45.6132 11.0311 45.2702C9.86323 44.8158 9.02993 44.2746 8.15381 43.4002C7.27768 42.5258 6.73536 41.6938 6.28269 40.5266C5.93928 39.6466 5.53304 38.3214 5.42217 35.884C5.3009 33.2488 5.27668 32.4572 5.27668 25.781C5.27668 19.1048 5.3029 18.3154 5.42217 15.678C5.53324 13.2406 5.94248 11.918 6.28269 11.0354C6.73736 9.86816 7.27888 9.03536 8.15381 8.15976C9.02873 7.28416 9.86123 6.74216 11.0311 6.28976C11.9117 5.94656 13.2377 5.54056 15.6765 5.42976C18.3133 5.30856 19.1054 5.28436 25.7826 5.28436C32.4598 5.28436 33.2527 5.31056 35.8916 5.42976C38.3305 5.54076 39.6539 5.94976 40.537 6.28976C41.7049 6.74216 42.5382 7.28536 43.4144 8.15976C44.2905 9.03416 44.8308 9.86816 45.2855 11.0354C45.6289 11.9154 46.0351 13.2406 46.146 15.678C46.2673 18.3154 46.2915 19.1048 46.2915 25.781C46.2915 32.4572 46.2673 33.2466 46.146 35.884C46.0349 38.3214 45.6267 39.6462 45.2855 40.5266C44.8308 41.6938 44.2893 42.5266 43.4144 43.4002C42.5394 44.2738 41.7049 44.8158 40.537 45.2702C39.6565 45.6134 38.3305 46.0194 35.8916 46.1302C33.2549 46.2514 32.4628 46.2756 25.7826 46.2756C19.1024 46.2756 18.3125 46.2514 15.6765 46.1302ZM15.4694 0.932162C12.8064 1.05336 10.9867 1.47536 9.39755 2.09336C7.75177 2.73156 6.35853 3.58776 4.9663 4.97696C3.57406 6.36616 2.71955 7.76076 2.08097 9.40556C1.46259 10.9948 1.04034 12.8124 0.919069 15.4738C0.795795 18.1394 0.767578 18.9916 0.767578 25.7808C0.767578 32.57 0.795795 33.4222 0.919069 36.0878C1.04034 38.7494 1.46259 40.5668 2.08097 42.156C2.71955 43.7998 3.57426 45.196 4.9663 46.5846C6.35833 47.9732 7.75177 48.8282 9.39755 49.4682C10.9897 50.0862 12.8064 50.5082 15.4694 50.6294C18.138 50.7506 18.9893 50.7808 25.7826 50.7808C32.5759 50.7808 33.4286 50.7526 36.0958 50.6294C38.759 50.5082 40.5774 50.0862 42.1676 49.4682C43.8124 48.8282 45.2066 47.9738 46.5989 46.5846C47.9911 45.1954 48.8438 43.7998 49.4842 42.156C50.1026 40.5668 50.5268 38.7492 50.6461 36.0878C50.7674 33.4202 50.7956 32.57 50.7956 25.7808C50.7956 18.9916 50.7674 18.1394 50.6461 15.4738C50.5248 12.8122 50.1026 10.9938 49.4842 9.40556C48.8438 7.76176 47.9889 6.36836 46.5989 4.97696C45.2088 3.58556 43.8124 2.73156 42.1696 2.09336C40.5775 1.47536 38.7588 1.05136 36.0978 0.932162C33.4306 0.810962 32.5779 0.780762 25.7846 0.780762C18.9913 0.780762 18.138 0.808962 15.4694 0.932162Z"
                                        fill="" />
                                    <path
                                        d="M17.4456 25.7808C17.4456 21.1786 21.1776 17.4468 25.7826 17.4468C30.3875 17.4468 34.1216 21.1786 34.1216 25.7808C34.1216 30.383 30.3875 34.1148 25.7826 34.1148C21.1776 34.1148 17.4456 30.383 17.4456 25.7808ZM12.9377 25.7808C12.9377 32.8708 18.6883 38.618 25.7826 38.618C32.8768 38.618 38.6275 32.8708 38.6275 25.7808C38.6275 18.6908 32.8768 12.9436 25.7826 12.9436C18.6883 12.9436 12.9377 18.6908 12.9377 25.7808ZM36.1342 12.4346C36.1339 13.0279 36.3098 13.608 36.6394 14.1015C36.9691 14.595 37.4377 14.9797 37.9861 15.2069C38.5346 15.4342 39.1381 15.4939 39.7204 15.3784C40.3028 15.2628 40.8378 14.9773 41.2577 14.5579C41.6777 14.1385 41.9638 13.6041 42.0799 13.0222C42.1959 12.4403 42.1367 11.8371 41.9097 11.2888C41.6828 10.7406 41.2982 10.2719 40.8047 9.94202C40.3112 9.61218 39.7309 9.436 39.1372 9.43576H39.136C38.3402 9.43613 37.5771 9.75216 37.0142 10.3144C36.4514 10.8767 36.1349 11.6392 36.1342 12.4346ZM15.6765 46.1302C13.2377 46.0192 11.9121 45.6132 11.0311 45.2702C9.86323 44.8158 9.02993 44.2746 8.15381 43.4002C7.27768 42.5258 6.73536 41.6938 6.28269 40.5266C5.93928 39.6466 5.53304 38.3214 5.42217 35.884C5.3009 33.2488 5.27668 32.4572 5.27668 25.781C5.27668 19.1048 5.3029 18.3154 5.42217 15.678C5.53324 13.2406 5.94248 11.918 6.28269 11.0354C6.73736 9.86816 7.27888 9.03536 8.15381 8.15976C9.02873 7.28416 9.86123 6.74216 11.0311 6.28976C11.9117 5.94656 13.2377 5.54056 15.6765 5.42976C18.3133 5.30856 19.1054 5.28436 25.7826 5.28436C32.4598 5.28436 33.2527 5.31056 35.8916 5.42976C38.3305 5.54076 39.6539 5.94976 40.537 6.28976C41.7049 6.74216 42.5382 7.28536 43.4144 8.15976C44.2905 9.03416 44.8308 9.86816 45.2855 11.0354C45.6289 11.9154 46.0351 13.2406 46.146 15.678C46.2673 18.3154 46.2915 19.1048 46.2915 25.781C46.2915 32.4572 46.2673 33.2466 46.146 35.884C46.0349 38.3214 45.6267 39.6462 45.2855 40.5266C44.8308 41.6938 44.2893 42.5266 43.4144 43.4002C42.5394 44.2738 41.7049 44.8158 40.537 45.2702C39.6565 45.6134 38.3305 46.0194 35.8916 46.1302C33.2549 46.2514 32.4628 46.2756 25.7826 46.2756C19.1024 46.2756 18.3125 46.2514 15.6765 46.1302ZM15.4694 0.932162C12.8064 1.05336 10.9867 1.47536 9.39755 2.09336C7.75177 2.73156 6.35853 3.58776 4.9663 4.97696C3.57406 6.36616 2.71955 7.76076 2.08097 9.40556C1.46259 10.9948 1.04034 12.8124 0.919069 15.4738C0.795795 18.1394 0.767578 18.9916 0.767578 25.7808C0.767578 32.57 0.795795 33.4222 0.919069 36.0878C1.04034 38.7494 1.46259 40.5668 2.08097 42.156C2.71955 43.7998 3.57426 45.196 4.9663 46.5846C6.35833 47.9732 7.75177 48.8282 9.39755 49.4682C10.9897 50.0862 12.8064 50.5082 15.4694 50.6294C18.138 50.7506 18.9893 50.7808 25.7826 50.7808C32.5759 50.7808 33.4286 50.7526 36.0958 50.6294C38.759 50.5082 40.5774 50.0862 42.1676 49.4682C43.8124 48.8282 45.2066 47.9738 46.5989 46.5846C47.9911 45.1954 48.8438 43.7998 49.4842 42.156C50.1026 40.5668 50.5268 38.7492 50.6461 36.0878C50.7674 33.4202 50.7956 32.57 50.7956 25.7808C50.7956 18.9916 50.7674 18.1394 50.6461 15.4738C50.5248 12.8122 50.1026 10.9938 49.4842 9.40556C48.8438 7.76176 47.9889 6.36836 46.5989 4.97696C45.2088 3.58556 43.8124 2.73156 42.1696 2.09336C40.5775 1.47536 38.7588 1.05136 36.0978 0.932162C33.4306 0.810962 32.5779 0.780762 25.7846 0.780762C18.9913 0.780762 18.138 0.808962 15.4694 0.932162Z"
                                        fill="" />
                                    <defs>
                                        <radialGradient id="paint0_radial_7092_54404" cx="0" cy="0" r="1"
                                            gradientUnits="userSpaceOnUse"
                                            gradientTransform="translate(7.41436 51.017) scale(65.31 65.2708)">
                                            <stop offset="0.09" stop-color="#FA8F21" />
                                            <stop offset="0.78" stop-color="#D82D7E" />
                                        </radialGradient>
                                        <radialGradient id="paint1_radial_7092_54404" cx="0" cy="0" r="1"
                                            gradientUnits="userSpaceOnUse"
                                            gradientTransform="translate(31.1086 53.257) scale(51.4733 51.4424)">
                                            <stop offset="0.64" stop-color="#8C3AAA" stop-opacity="0" />
                                            <stop offset="1" stop-color="#8C3AAA" />
                                        </radialGradient>
                                    </defs>
                                </svg>
                                <div
                                    class="absolute top-full left-0 w-full h-full rounded-full bg-gradient-to-bl from-purple-500 via-pink-500 to-yellow-500 z-0 transition-all duration-500 group-hover:top-0">
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </div>






        </div>

    </div>

</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&display=swap');

html,
body {
    font-family: 'DM Sans', sans-serif;
}

body {
    background-color: #050505;
}


button:hover .svg-icon {
    fill: #ffffff;
    /* orange-600 */
}


@keyframes fade-in-up {
    from {
        opacity: 0;
        transform: translateY(20px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}

/* Apply fade-in-up animation to elements with the .fade-in-up class */
.fade-in-up {
    animation: fade-in-up 0.5s ease-in-out;
}

/* Showcase image animation */
.image-container {
    overflow: hidden;
    /* Hide any overflow from the scaled image */
    border-radius: inherit;
    /* Preserve the rounded corners of the parent container */
}

.showcase-image {
    transition: transform 0.3s ease;
}

.image-container:hover .showcase-image {
    transform: scale(1.1);
    /* Scale up by 10% on hover */
}



.swiper-pagination-bullet {
    background-color: #bc4ee4;

}
</style>
