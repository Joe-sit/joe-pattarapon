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
import StackSVG from '../../assets/stack.svg'


const goToLinkedIn = () => {
    window.open('https://www.linkedin.com/in/pattarapon-makhirun-a06011214/', '_blank')
}

const goToInstagram = () => {
    window.open('https://www.instagram.com/joe_autismxd/', '_blank')

}

const goToTranscript = () => {
    window.open('https://drive.google.com/file/d/1Y050T_mqrkQ86p7JJax8Cx5qH5_pwRsB/view?usp=sharing', '_blank')
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
                    <div class="col-span-1 md:col-span-6 flex justify-center items-center">
                        <img src="../../assets/joe-picture.png" class="object-cover w-full h-full rounded-xl"
                            alt="Profile Picture" />
                    </div>
                    <!-- Profile Info Section -->
                    <div class="col-span-1 md:col-span-6 flex flex-col">
                        <div class="w-full bg-[#101010] border border-[#ffffff]/5 rounded-xl">
                            <h1
                                class="mx-4 mt-4 mb-6 flex text-[#F2F2F2] px-3 py-1 border border-[#ffffff]/5 bg-[#141414] rounded-full w-fit md:mb-4 text-xs sm:text-sm md:text-base lg:text-lg">
                                <span>
                                    <GreenSVG class="inline-block align-middle mr-1 sm:mr-2" />
                                </span>Open to Work
                            </h1>
                            <h1
                                class="mx-4 mt-4 text-[#F2F2F2] text-2xl sm:text-3xl md:text-4xl mb-2 md:mb-4 font-bold">
                                Pattarapon Makhirun
                            </h1>
                            <h1
                                class="mx-4 mt-4 text-[#F2F2F2] text-sm sm:text-base md:text-base lg:text-lg mb-2 md:mb-4">
                                I'm a
                                <span
                                    class="font-bold bg-gradient-to-r from-[#2F80ED] to-[#BB6BD9] inline-block text-transparent bg-clip-text">Designer/Developer</span>
                            </h1>
                            <div class="w-full mt-6">
                                <div
                                    class="border mx-4 mb-4 p-2 border-[#ffffff]/5 rounded-xl bg-[#141414] flex flex-wrap gap-2">
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
                                        <span class="text-xs sm:text-sm text-white whitespace-nowrap">Thai &
                                            English</span>
                                    </div>
                                    <!-- University -->
                                    <div
                                        class="flex items-center px-2 py-1 bg-[#191919] border border-[#ffffff]/5 rounded-full mb-2 sm:mb-0">
                                        <span class="inline-block align-middle mr-2">
                                            <CertSVG class="h-4 w-4" />
                                        </span>
                                        <span class="text-xs sm:text-sm text-white whitespace-nowrap">KMUTT</span>
                                    </div>
                                    <!-- Major -->
                                    <div
                                        class="flex items-center px-2 py-1 bg-[#191919] border border-[#ffffff]/5 rounded-full mb-2 sm:mb-0">
                                        <span class="inline-block align-middle mr-2">
                                            <GraduateSVG class="h-4 w-4" />
                                        </span>
                                        <span class="text-xs sm:text-sm text-white whitespace-nowrap"> B.Sc. (Information Technology)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <!-- About Section -->
                        <div class="bg-[#101010]  border border-[#ffffff]/5 rounded-xl p-4 mt-4 md:mt-4 h-full">
                            <h1 class="font-medium text-base sm:text-xl text-[#8A949C] mb-4 ">About me</h1>
                            <p class="text-xl font-normal ">
                                A senior IT student passionate about digital product design and web app development.
                            </p>

                            <!-- Go to About Page (Coming Soon) -->
                            <!-- <div class="grid justify-end my-2 mx-2 ">
                                <GoSVG class="w-6 md:w-10" viewBox="0 0 40 40" />
                            </div> -->

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
                            class="flex items-center gap-x-2 justify-center text-base md:text-4xl font-bold py-12 text-center">
                            <h1 class=" py-2">Explore my interesting works</h1>


                            <GoSVG class="w-6 md:w-10 " viewBox="0 0 40 40" />

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

            <div class="max-w-screen-lg w-full px-4">
                <!-- Projects and Contact Section -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 mx-2 ">

                    <!-- Contact -->
                    <div class="col-span-1 rounded-xl bg-[#101010] border border-[#ffffff]/5">
                        <h1 class=" text-base sm:text-xl text-[#8A949C] mx-6 mt-6">Contacts</h1>
                        <!-- Email -->
                        <div class="flex flex-col mt-4 mx-6 ">
                            <div class="flex items-center">
                                <EmailSVG class="my-auto mr-4" />
                                <a href="mailto:pattarapon.mak@gmail.com" class="email-address  text-lg 
                                    text-white break-words sm:text-base md:text-2xl">
                                    pattarapon.mak@gmail.com
                                </a>
                            </div>
                        </div>

                        <!-- Phone -->
                        <div class="flex mt-4 mx-6 ">
                            <PhoneSVG class="my-auto mr-4" />
                            <p class=" sm:text-base md:text-2xl text-white break-words ">(+66) 61 786 1777
                            </p>
                        </div>

                        <!-- Copy email button -->
                        <div class="flex justify-end mx-6 mt-10 ">
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

                    <!-- Projects -->
                    <div class="col-span-1 rounded-xl bg-[#101010]
                        border border-[#ffffff]/5 max-h-full ">
                        <div>
                            <h1 class="font-medium text-base sm:text-xl text-[#8A949C] mx-6 mt-6">Docs & Socials</h1>

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
</style>
