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
import GreenSVG from '../../assets/open-status.svg'
import MapSVG from '../../assets/map-pin-fill.svg'
import GlobeSVG from '../../assets/globe-fill.svg'
import CertSVG from '../../assets/certificate-fill.svg'
import GraduateSVG from '../../assets/graduation-cap-fill.svg'

const goToLinkedIn = () => {
    window.open('https://www.linkedin.com/in/joe-pattarapon-a06011214/', '_blank')
}

const goToInstagram = () => {
    window.open('https://www.instagram.com/joe_autismxd/', '_blank')

}

const goToTranscript = () => {
    window.open('https://drive.google.com/file/d/1Y050T_mqrkQ86p7JJax8Cx5qH5_pwRsB/view?usp=sharing', '_blank')
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
    <div class="">

        <div class="fade-in-up mx-auto max-w-screen-lg min-h-screen mb-6">
            <!--About Section---->
            <div class="">
                <div class="grid grid-cols-12 gap-4 mx-6 mt-6">
                    <!-- Profile -->
                    <div class="col-span-12 md:col-span-7 bg-[#101010] 
                    border border-[#ffffff]/5 rounded-xl ">
                        <!-- Profile Details -->
                        <div class="flex flex-cols-1 md:flex-cols-2 mt-6 mx-6 gap-x-6">
                            <!-- Left Details -->
                            <img src="../../assets/joe-picture.png" class="object-cover object-center max-w-[120px] 
                                md:max-w-full md:w-[140px] lg:w-[200px] rounded-xl" />
                            <!-- Right Details -->
                            <div class="w-full">
                                <h1
                                    class="flex text-[#F2F2F2] px-3 py-1 border border-[#ffffff]/5 bg-[#141414] rounded-full w-fit mb-2 md:mb-4 text-xs sm:text-sm md:text-base lg:text-lg">
                                    <span>
                                        <GreenSVG class="inline-block align-middle mr-1 sm:mr-2" />
                                    </span>Open to Work
                                </h1>
                                <h1 class="text-[#F2F2F2] text-2xl sm:text-3xl md:text-4xl mb-2 md:mb-4 font-bold">Joe
                                    Pattarapon
                                </h1>
                                <h1 class="text-[#F2F2F2] text-sm sm:text-base md:text-base lg:text-lg mb-2 md:mb-4">I'm
                                    a <span
                                        class="font-bold bg-gradient-to-r from-[#2F80ED] to-[#BB6BD9] inline-block text-transparent bg-clip-text">Designer/Developer</span>
                                </h1>
                            </div>
                        </div>

                        <!-- FYI Details -->
                        <div class="w-full mt-6 mb-4">
                            <div class="border mx-6 p-4 border-[#ffffff]/5 rounded-xl bg-[#141414] 
                                flex flex-wrap gap-2">
                                <!-- Location -->
                                <div
                                    class="flex items-center px-2 py-1 bg-[#191919] border border-[#ffffff]/5 rounded-full mb-2 sm:mb-0">
                                    <span class="inline-block align-middle mr-2">
                                        <MapSVG class="h-4 w-4" />
                                    </span>
                                    <span class="text-xs sm:text-sm text-white whitespace-nowrap">Thailand</span>
                                </div>
                                <!-- Language -->
                                <div
                                    class="flex items-center px-2 py-1 bg-[#191919] border border-[#ffffff]/5 rounded-full mb-2 sm:mb-0">
                                    <span class="inline-block align-middle mr-2">
                                        <GlobeSVG class="h-4 w-4" />
                                    </span>
                                    <span class="text-xs sm:text-sm text-white whitespace-nowrap">Thai & English</span>
                                </div>
                                <!-- University -->
                                <div
                                    class="flex items-center px-2 py-1 bg-[#191919] border border-[#ffffff]/5 rounded-full mb-2 sm:mb-0">
                                    <span class="inline-block align-middle mr-2">
                                        <CertSVG class="h-4 w-4" />
                                    </span>
                                    <span class="text-xs sm:text-sm text-white whitespace-nowrap">KMUTT
                                        University</span>
                                </div>
                                <!-- Major -->
                                <div
                                    class="flex items-center px-2 py-1 bg-[#191919] border border-[#ffffff]/5 rounded-full mb-2 sm:mb-0">
                                    <span class="inline-block align-middle mr-2">
                                        <GraduateSVG class="h-4 w-4" />
                                    </span>
                                    <span class="text-xs sm:text-sm text-white whitespace-nowrap">Information
                                        Technology</span>
                                </div>
                            </div>
                        </div>

                    </div>
                    <!-- Column -->
                    <div class="col-span-12 md:col-span-5 bg-[#101010] border border-[#ffffff]/5 rounded-xl 
                        w-full ">
                        <h1 class="font-medium text-base sm:text-xl text-[#8A949C] mx-6 mt-6">ABOUT</h1>
                        <p class="mt-4 mx-6 text-base sm:text-xl text-white break-words">
                            A senior IT student who passionate about digital product design and
                            web app development.
                            <a href="" class="text-xs inline-block align-middle font-medium underline">Read more</a>
                        </p>


                        <!-- Basic Contacts Info. -->
                        <div class="grid text-[#F3F3F3] mt-4 mx-6">
                            <button class="border flex justify-start transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]
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

                <!-- Showcases #1 -->
                <div class="grid grid-cols-12 gap-4 mt-4 mx-6">
                    <!-- Column -->
                    <div class="col-span-12 md:col-span-6 rounded-xl">
                        <div class="image-container">
                            <img src="../../assets/mod-ride-showcase-home.png" alt="mod-ride-showcase"
                                class="showcase-image object-cover object-center">
                        </div>
                    </div>
                    <!-- Column -->
                    <div class="col-span-12 md:col-span-6 rounded-xl">
                        <div class="image-container">
                            <img src="../../assets/ekyc-showcase.png" alt="mod-ride-showcase"
                                class="showcase-image object-cover object-center">
                        </div>
                    </div>
                </div>

                <!-- Showcases #2 -->
                <div class="grid grid-col mt-4 mx-6">
                    <!-- Column -->
                    <div class="col-span-12 md:col-span-6 rounded-xl">
                        <div class="image-container">
                            <img src="../../assets/user-management-showcase.png" alt="mod-ride-showcase"
                                class="showcase-image object-cover object-center ">
                        </div>
                    </div>
                </div>

                <!-- Projects and Contact-->
                <div class="grid grid-cols-12 gap-4 mt-4 mx-6 ">

                    <!-- Projects -->
                    <router-link :to="{ name: 'Portfolio' }"
                        class="col-span-12 md:col-span-6 rounded-xl bg-[#101010]
                        border border-[#ffffff]/5 max-h-full transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]">


                        <h1 class="font-medium text-base sm:text-xl text-[#8A949C] mx-6 mt-6">PROJECTS</h1>
                        <div class="flex mt-4 mx-6">
                            <h1 class="font-medium text-xl sm:text-2xl text-white break-words">Explore all of my projects</h1>
                        </div>

                        <!-- Hidden content -->
                        <div class="opacity-0 flex mt-4 mx-6">
                            <PhoneSVG class="my-auto mr-4" />
                            <p class="font-medium text-2xl text-white break-words">lorem</p>
                        </div>

                        <div class="flex justify-end mx-6  ">
                            <button class="text-white my-11 rounded-xl">
                                <GoSVG class="" />
                            </button>
                        </div>

                    </router-link>

                    <!-- Contact -->
                    <div class="col-span-12 md:col-span-6 rounded-xl bg-[#101010] border border-[#ffffff]/5">
                        <h1 class="font-medium text-base sm:text-xl text-[#8A949C] mx-6 mt-6">CONTACTS</h1>
                        <!-- Email -->
                        <div class="flex flex-col mt-4 mx-6 ">
                            <div class="flex items-center">
                                <EmailSVG class="my-auto mr-4" />
                                <a href="mailto:pattarapon.mak@gmail.com" class="email-address font-medium text-lg 
                                    text-white break-words sm:text-base md:text-2xl">
                                    pattarapon.mak@gmail.com
                                </a>
                            </div>
                        </div>

                        <!-- Phone -->
                        <div class="flex mt-4 mx-6 ">
                            <PhoneSVG class="my-auto mr-4" />
                            <p class="font-medium sm:text-base md:text-2xl text-white break-words ">(+66) 61 786 1777</p>
                        </div>

                        <!-- Copy email button -->
                        <div class="flex justify-end mx-6 my-6 ">
                            <button v-if="!isCopied" @click="copyEmail" class="flex text-white bg-[#141414] my-4 rounded-xl px-4 py-4 
                            transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]">
                                Copy email<span class="mx-2">
                                    <ClipBoardSVG />
                                </span>
                            </button>
                            <button v-else class="flex text-white bg-[#141414] my-4 rounded-xl px-4 py-4 
                            transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F]">
                                Copied<span class="mx-2">
                                    <CheckSVG />
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Other Contacts -->
                <!-- <div class="grid grid-cols-12 gap-6 text-white mx-6 mt-6 "> -->

                <!-- LinkIn -->
                <!-- <button @click="goToLinkedIn" class="col-span-12 md:col-span-6 lg:col-span-3 
                    rounded-xl bg-[#272727] border border-[#ffffff]/5 
                    transition-colors duration-300 ease-in-out hover:bg-[#0A66C2]">
                        <LinkedInSVG class="mx-auto my-6 " />
                    </button> -->

                <!-- Instagram -->
                <!-- <button @click="goToInstagram" class="col-span-12 md:col-span-6 lg:col-span-3 
                    rounded-xl bg-[#272727] border border-[#ffffff]/5
                    transition-colors duration-300 ease-in-out hover:bg-[#8C3AAA]">
                        <InstagramSVG class="mx-auto my-6 " />
                    </button> -->

                <!-- Resume -->
                <!-- <button class="col-span-12 md:col-span-6 lg:col-span-3 
                    rounded-xl bg-[#272727] border border-[#ffffff]/5
                    transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] ">
                        <ResumeSVG class="mx-auto  " />
                    </button> -->

                <!-- Transcript -->
                <!-- <button class="col-span-12 md:col-span-6 lg:col-span-3 
                    rounded-xl bg-[#272727]  border border-[#ffffff]/5
                    transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] ">
                        <TranscriptSVG class="mx-auto " />
                    </button> -->

            </div>
        </div>

        <div class="flex text-white font-light text-sm my-6">
            <span class="mx-auto">All Right Reserved 2024</span>
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
</style>
