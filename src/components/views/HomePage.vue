<script setup>
import { ref, onMounted } from 'vue'
import EmailSVG from '../../assets/email_svgrepo.com.svg'
import PhoneSVG from '../../assets/phone.svg'
import ClipBoardSVG from '../../assets/select_window_2.svg'
import CheckSVG from '../../assets/check.svg'
import LinkedInSVG from '../../assets/linkedin_svgrepo.com.svg'
import InstagramSVG from '../../assets/instagram_svgrepo.com.svg'
import ResumeSVG from '../../assets/resume.svg'
import TranscriptSVG from '../../assets/transcript.svg'
import GoSVG from '../../assets/bubble.svg'

const goToLinkedIn = () => {
    window.open('https://www.linkedin.com/in/joe-pattarapon-a06011214/', '_blank')
}

const goToInstagram = () => {
    window.open('https://www.instagram.com/joe_autismxd/', '_blank')

}

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
            <div class="w-full  ">
                <div class="mx-6 my-6 bg-[#272727] border border-[#ffffff]/5 rounded-xl">
                    <div class="my-10 mx-6">
                        <h1 class="text-white text-4xl mb-6">
                            <span class="">Hi, I’m </span><span class="font-medium">Joe Pattarapon</span>
                        </h1>
                        <p class="text-2xl text-[#E9EAEB] break-words">Passionate about design and enjoy making ideas
                            for better
                            solution. Passionate about design and enjoy making ideas for better solution.</p>
                    </div>
                </div>
            </div>

            <!--About Section---->
            <div class="">
                <div class="grid grid-cols-12 gap-6 mx-6">
                    <!-- Column -->
                    <div class="col-span-12 md:col-span-4">
                        <img src="../../assets/me-white-bg.png" class=" object-cover object-center ">
                    </div>
                    <!-- Column -->
                    <a href="" class="col-span-12 md:col-span-8 bg-[#272727] border border-[#ffffff]/5 rounded-xl 
            w-full transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a]">
                        <h1 class="font-medium text-lg text-[#8A949C] mx-6 mt-6">ABOUT</h1>
                        <p class="mt-4 font-medium mx-6 text-2xl text-white break-words">
                            Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has
                            been the
                            industry's standard dummy text ever since the 1500s, when an unknown printer took a galley
                            of type and
                            scrambled it to make a type specimen book.
                        </p>
                        <!-- Read more button -->
                        <div class="flex justify-end my-8">
                            <button class="text-white border rounded-xl px-4 py-4 justify-end mx-6
              transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] ">Read more</button>
                        </div>

                    </a>
                </div>

                <!-- Showcases #1 -->
                <div class="grid grid-cols-12 gap-6 mt-6 mx-6">
                    <!-- Column -->
                    <div class="col-span-12 md:col-span-6 rounded-xl">
                        <div class="image-container">
                            <img src="../../assets/mod-ride-showcase-home.png" alt="mod-ride-showcase"
                                class="showcase-image object-cover object-center   ">
                        </div>
                    </div>
                    <!-- Column -->
                    <div class="col-span-12 md:col-span-6 rounded-xl">
                        <div class="image-container">
                            <img src="../../assets/ekyc-showcase.png" alt="mod-ride-showcase"
                                class="showcase-image object-cover object-center ">
                        </div>
                    </div>
                </div>

                <!-- Showcases #2 -->
                <div class="grid grid-col mt-6 mx-6">
                    <!-- Column -->
                    <div class="col-span-12 md:col-span-6 rounded-xl">
                        <div class="image-container">
                            <img src="../../assets/user-management-showcase.png" alt="mod-ride-showcase"
                                class="showcase-image object-cover object-center ">
                        </div>
                    </div>
                </div>

                <!-- Projects and Contact-->
                <div class="grid grid-cols-12 gap-6 mt-6 mx-6 ">

                    <!-- Projects -->
                    <a href="./portfolio" class="col-span-12 md:col-span-6 rounded-xl bg-[#272727]
          border border-[#ffffff]/5 max-h-full transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a]">
                        <h1 class="font-medium text-lg text-[#8A949C] mx-6 mt-6">PROJECTS</h1>
                        <div class="flex mt-4 mx-6">
                            <h1 class="font-medium text-2xl text-white break-words">Explore all of my projects</h1>
                        </div>

                        <!-- Hidden content -->
                        <div class="opacity-0 flex mt-4 mx-6  ">
                            <PhoneSVG class="my-auto mr-4" />
                            <p class="font-medium text-2xl text-white break-words">lorem</p>
                        </div>

                        <div class="flex justify-end mx-6  ">
                            <button class="text-white my-11 rounded-xl">
                                <GoSVG class="" />
                            </button>
                        </div>
                    </a>

                    <!-- Contact -->
                    <div class="col-span-12 md:col-span-6 rounded-xl bg-[#272727] border border-[#ffffff]/5">
                        <h1 class="font-medium text-lg text-[#8A949C] mx-6 mt-6">CONTACTS</h1>
                        <!-- Email -->
                        <div class="flex mt-4 mx-6">
                            <EmailSVG class="my-auto mr-4" />
                            <a href="mailto:pattarapon.mak@gmail.com"
                                class="font-medium text-2xl text-white break-words">pattarapon.mak@gmail.com</a>
                        </div>

                        <!-- Phone -->
                        <div class="flex mt-4 mx-6 ">
                            <PhoneSVG class="my-auto mr-4" />
                            <p class="font-medium text-2xl text-white break-words ">(+66) 61 786 1777</p>
                        </div>

                        <!-- Copy email button -->
                        <div class="flex justify-end mx-6 my-6 ">
                            <button v-if="!isCopied" @click="copyEmail" class="flex text-white bg-[#2E2E2E] my-4 rounded-xl px-4 py-4 
                transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a]">
                                Copy email<span class="mx-2">
                                    <ClipBoardSVG />
                                </span>
                            </button>
                            <button v-else class="flex text-white bg-[#2E2E2E] my-4 rounded-xl px-4 py-4 
                transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a]">
                                Copied<span class="mx-2">
                                    <CheckSVG />
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Other Contacts -->
                <div class="grid grid-cols-12 gap-6 text-white mx-6 mt-6 ">

                    <!-- LinkIn -->
                    <button @click="goToLinkedIn" class="col-span-12 md:col-span-6 lg:col-span-3 
          rounded-xl bg-[#272727] border border-[#ffffff]/5 
          transition-colors duration-300 ease-in-out hover:bg-[#0A66C2]">
                        <LinkedInSVG class="mx-auto my-6 " />
                    </button>

                    <!-- Instagram -->
                    <button @click="goToInstagram" class="col-span-12 md:col-span-6 lg:col-span-3 
          rounded-xl bg-[#272727] border border-[#ffffff]/5
          transition-colors duration-300 ease-in-out hover:bg-[#8C3AAA]">
                        <InstagramSVG class="mx-auto my-6 " />
                    </button>

                    <!-- Resume -->
                    <button class="col-span-12 md:col-span-6 lg:col-span-3 
          rounded-xl bg-[#272727] border border-[#ffffff]/5
          transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] ">
                        <ResumeSVG class="mx-auto  " />
                    </button>

                    <!-- Transcript -->
                    <button class="col-span-12 md:col-span-6 lg:col-span-3 
          rounded-xl bg-[#272727]  border border-[#ffffff]/5
          transition-colors duration-300 ease-in-out hover:bg-[#3a3a3a] ">
                        <TranscriptSVG class="mx-auto " />
                    </button>

                </div>
            </div>

            <div class="flex text-white font-light text-sm mt-6">
                <span class="mx-auto">All Right Reserved 2024</span>
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
    background-color: #1C1C1C;
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
