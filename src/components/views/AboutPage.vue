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
        <div class="text-white min-h-screen flex flex-col items-center py-10 ">
            <div class="max-w-screen-lg w-full px-4">
                <!-- Grid Layout -->
                <div class="grid grid-cols-1 md:grid-cols-12 gap-4 mx-2">
                    <!-- Image Section -->
                    <div class="col-span-1 md:col-span-4 flex justify-center items-center">
                        <img src="../../assets/joe-picture.png" class="object-cover w-full h-full rounded-xl"
                            alt="Profile Picture" />
                    </div>
                    <!-- Profile Info Section -->
                    <div class="col-span-1 md:col-span-8 flex flex-col">

                        <!-- About Section -->
                        <div class="bg-[#101010]  border border-[#ffffff]/5 rounded-xl p-4  h-full">
                            <h1 class="font-medium text-base sm:text-base text-[#8A949C] mb-4 ">About me</h1>
                            <p class="text-sm sm:text-lg font-light break-keep ">
                                Hey there! I’m Pattarapon Makhirun, but you can call me Joe. I was born and raised in
                                Bangkok, Thailand. From a young age, I've been passionate about visual design and
                                technology. I love merging creativity with practical solutions, which led me to study
                                Information Technology (IT) and take on a UX/UI design internship.
                            </p>

                            <p class="text-sm sm:text-lg font-light break-keep mt-2">
                                In my free time, I enjoy practicing piano and discovering new Jazz and J-Pop songs to
                                cover. While I'm not a fan of going outside much, you can often find me at cafes
                                enjoying my love for coffee.
                            </p>


                        </div>
                    </div>
                </div>








                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mx-2 ">

                    <div class="col-span-1 rounded-xl bg-[#101010] border border-[#ffffff]/5">
                        <h1 class="font-medium text-sm sm:text-base text-[#8A949C] mx-6 mt-6 mb-4">Education</h1>

                        <!-- KMUTT -->
                        <div class="mx-6 mb-6">
                            <p class="text-sm sm:text-lg font-light mb-2">2020 - 2024</p>
                            <p class="text-sm sm:text-lg font-medium mb-2">King Mongkut’s University of Technology
                                Thonburi (KMUTT)</p>
                            <div class="flex items-center justify-between">
                                <p class="text-sm sm:text-lg font-light">B.Sc. Information Technology</p>
                                <span class="text-sm sm:text-base border border-[#ffffff]/5 rounded-lg px-2">GPAX
                                    3.58</span>
                            </div>
                        </div>

                        <!-- SKT -->
                        <div class="mx-6 mb-6">
                            <p class="text-sm sm:text-lg font-light mb-2">2014 - 2020</p>
                            <p class="text-sm sm:text-lg font-medium mb-2">Suankularb Wittayalai Thonburi (SKT)</p>
                            <div class="flex items-center justify-between">
                                <p class="text-sm sm:text-lg font-light">English-Mathematics Program</p>
                                <span class="text-sm sm:text-base border border-[#ffffff]/5 rounded-lg px-2">GPAX
                                    3.68</span>
                            </div>
                        </div>
                    </div>


                    <!-- My stacks -->
                    <div class="col-span-1 rounded-xl bg-[#101010] border border-[#ffffff]/5 max-h-full ">
                        <div>
                            <h1 class="font-medium text-sm sm:text-base text-[#8A949C] mx-6 mt-6">My stacks</h1>

                            <!-- Stacks -->
                            <div class="grid text-[#F3F3F3] mt-4 mx-6">

                                <div class="border flex items-center  border-[#ffffff]/5 w-full 
                                    px-4 py-4 rounded-xl bg-[#141414] font-medium text-sm sm:text-lg mb-4">
                                    <FigmaSVG class="mr-2" />Figma
                                    <!-- Stacks description -->
                                    <p class="ml-auto font-light text-base hidden sm:block ">Design Tools</p>
                                </div>

                                <div class="border flex items-center  border-[#ffffff]/5 w-full
                                     px-4 py-4 rounded-xl bg-[#141414] font-medium text-sm sm:text-lg mb-4">
                                    <MondaySVG class="mr-2" />Monday
                                    <p class="ml-auto font-light text-base hidden sm:block">Project Management</p>
                                </div>

                                <div class="border flex items-center  border-[#ffffff]/5 w-full 
                                    px-4 py-4 rounded-xl bg-[#141414] font-medium text-sm sm:text-lg mb-4">
                                    <VSCodeSVG class="mr-2" />Visual Studio Code
                                    <p class="ml-auto font-light text-base hidden sm:block">Code Editor</p>
                                </div>

                                <div class="border flex items-center  border-[#ffffff]/5 w-full
                                     px-4 py-4 rounded-xl bg-[#141414] font-medium text-sm sm:text-lg mb-4">
                                    <GitHubSVG class="mr-2 " />GitHub
                                    <p class="ml-auto font-light text-base hidden sm:block">Version Control</p>
                                </div>

                            </div>
                        </div>
                    </div>

                </div>

                <!-- Explore Section -->
                <div class="grid grid-cols-12 gap-4 mt-4 mx-2">

                    <!-- Explore wording -->
                    <router-link :to="{ name: 'Portfolio' }" class="bg-[#101010] border border-[#ffffff]/5 rounded-xl
                        col-span-8 md:col-span-10 flex justify-center items-center
                        transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]">
                        <div
                            class="flex items-center gap-x-2 justify-center text-sm md:text-4xl font-bold py-12 text-center">
                            <h1 class="py-2">Explore my interesting works</h1>


                            <GoSVG class="w-4 md:w-10 " viewBox="0 0 40 40" />

                        </div>
                    </router-link>


                    <!-- Count Works -->
                    <div class="bg-[#101010] border border-[#ffffff]/5 rounded-xl 
                        col-span-4 md:col-span-2 flex flex-col justify-center items-center">
                        <h1 class="text-4xl md:text-6xl py-2
                            font-bold bg-gradient-to-b from-slate-50 to-gray-700 bg-clip-text text-transparent">
                            10+
                        </h1>
                        <div
                            class="flex items-center px-2 py-1 bg-[#191919] border border-[#ffffff]/5 rounded-full mb-2 sm:mb-0">
                            <span class="inline-block align-middle mr-2">
                                <StackSVG class="h-4 w-4" />
                            </span>
                            <span class="text-xs sm:text-sm text-white whitespace-nowrap">
                                Works
                            </span>
                        </div>
                    </div>

                </div>


            </div>




            <div class="max-w-screen-lg w-full px-4">
                <!-- Projects and Contact Section -->
                <div class="grid grid-cols-12 md:grid-cols-12 gap-4 mt-4 mx-2 ">

                    <!-- Contact -->
                    <div class="col-span-12 md:col-span-5 rounded-xl bg-[#101010]
                        border border-[#ffffff]/5 max-h-full ">
                        <div>
                            <h1 class="font-medium text-sm sm:text-base text-[#8A949C] mx-6 mt-6">Docs & Socials</h1>

                            <!-- Basic Contacts Info. -->
                            <div class="grid text-[#F3F3F3] mt-4 mx-6">
                                <button @click="goToResume" class="border flex justify-start transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]
                            border-[#ffffff]/5 w-full px-4 py-4 rounded-xl bg-[#141414] font-medium text-base mb-4">
                                    <ResumeSVG class="mr-2" />Resume
                                </button>
                                <button @click="goToTranscript" class="border flex justify-start transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]
                            border-[#ffffff]/5 w-full px-4 py-4 rounded-xl bg-[#141414] font-medium text-base mb-4">
                                    <TranscriptSVG class="mr-2" />Transcript
                                </button>
                            </div>

                            <div class="flex mx-6 gap-x-4 justify-center text-[#F3F3F3] mb-6">
                                <button @click="goToLinkedIn" class="border transition-colors mx-auto 
                            duration-300 ease-in-out hover:bg-[#0A66C2]
                            border-[#ffffff]/5 w-full px-2 py-2 rounded-xl 
                            align-middle bg-[#141414] font-medium text-base">
                                    <LinkedInSVG class="inline-block align-middle mr-2" /><span
                                        class="inline-block align-middle">LinkedIn</span>
                                </button>

                                <button @click="goToInstagram" class="border transition-colors mx-auto 
                            duration-300 ease-in-out hover:bg-[#8C3AAA]
                            border-[#ffffff]/5 w-full px-2 py-2 rounded-xl 
                            align-middle bg-[#141414] font-medium text-base">
                                    <InstagramSVG class="inline-block align-middle mr-2" /><span
                                        class="inline-block align-middle">Instagram</span>
                                </button>
                            </div>

                        </div>
                    </div>



                    <div class="col-span-12 md:col-span-4 rounded-xl bg-[#101010] border border-[#ffffff]/5">


                        <!--Pagination-->

                        <swiper class="rounded-xl object-contain " :modules="[Pagination]" :pagination="true">
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
                        class="col-span-12 md:col-span-3 rounded-xl bg-[#101010] border border-[#ffffff]/5 max-h-full p-6 flex flex-col items-center text-center">
                        <div class="mb-4">
                            <CrownSVG class="mx-auto" />
                        </div>
                        <h1 class="text-white font-medium text-lg mb-6">Let’s get to know each other better</h1>

                        <!-- Copy email button -->
                        <div class="w-full">
                            <button v-if="!isCopied" @click="copyEmail"
                                class="flex items-center justify-center w-full text-white bg-[#141414] rounded-xl px-4 py-4 transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]">
                                Copy email<span class="ml-2">
                                    <ClipBoardSVG />
                                </span>
                            </button>
                            <button v-else
                                class="flex items-center justify-center w-full text-white bg-[#141414] rounded-xl px-4 py-4 transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]">
                                Copied<span class="ml-2">
                                    <CheckSVG />
                                </span>
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
