<script setup>
import { ref, onMounted } from 'vue'



const portfolios = ref([
    {
        portId: 1,
        portName: 'MOD RIDE - Ride Sharing in KMUTT',
        category: 'UX/UI',
        imgSrc: 'https://lh3.googleusercontent.com/drive-viewer/AKGpihbQe-D9M44esVS7EdVIfuCBgVWqX_QA4NjdFcWLMj1huovwUvwpLIZ_UgoOTPAC4EoXFFxiR5C7a_gjIIARSfUTn8jWDSMjNNY=w1960-h2500-rw-v1',
        subTitle: 'Experiential Learning Project 2023 - 2024'
    },
    {
        portId: 2,
        portName: 'eKYC Web Application',
        category: 'UX/UI',
        imgSrc: 'https://lh3.googleusercontent.com/drive-viewer/AKGpihYgGXwCVwiy_Nn3s5nVv9ka8INOKGIHGlkGvquLzoYSZC9hXWqwS4y_u_wNAuEs0o5GlrlkldWmYCVcZioroA-XG2lgqJVYnBA=w1960-h2500-rw-v1',
        subTitle: 'Experiential Learning Project 2023 - 2024'
    },
    {
        portId: 3,
        portName: 'Case-Keeper Dashboard',
        category: 'UX/UI',
        imgSrc: 'https://lh3.googleusercontent.com/drive-viewer/AKGpihbdjUKbOM2uyDi9pqcWF7CnK2T2Qq3xwPkR0fTq4nq_FacZYXRfJdnlTWdrL8whgVuO8AONKOlxEWBfU6A4_CZ_Fxm5kN_fPvI=w2508-h1730-rw-v1',
        subTitle: 'Experiential Learning Project 2023 - 2024'
    },
])

console.log(portfolios.value);
</script>

<template>
    <div class="">
        <div class="fade-in-up mx-auto max-w-screen-lg min-h-screen mb-6 border">
            <div class="w-full mt-10 flex ">
                <h1 class="mx-auto font-bold text-4xl text-white">Portfolio</h1>
            </div>


            <!--Filter Menu-->
            <div class="mx-6 mt-6">
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">

                    <button class="font-bold text-base text-[#272727] border rounded-3xl
                      px-6 py-2 bg-[#FFFFFF] border-[#ffffff]/5">All Categories</button>

                    <button class="font-bold text-base text-[#E9EAEB] border rounded-3xl
                      px-6 py-2 bg-[#272727] border-[#ffffff]/5 transition-colors duration-300 
                      ease-in-out hover:bg-[#3a3a3a]">UX/UI</button>
                    <button class="font-bold text-base text-[#E9EAEB] border rounded-3xl
                      px-6 py-2 bg-[#272727] border-[#ffffff]/5 transition-colors duration-300 
                      ease-in-out hover:bg-[#3a3a3a]">Web Dev</button>

                    <button class="font-bold text-base text-[#E9EAEB] border rounded-3xl
                      px-6 py-2 bg-[#272727] border-[#ffffff]/5 transition-colors duration-300 
                      ease-in-out hover:bg-[#3a3a3a]">Other</button>

                </div>
            </div>

            <!-- Portfolio Grid -->
            <div class="grid grid-cols-12 gap-6 mt-6 mx-6 ">
                <div v-for="portfolio in portfolios" :key="portfolio.portId"
                    class="col-span-12 md:col-span-6 rounded-xl ">
                    <!-- <span class="text-white">{{ portfolio.portName }}</span> -->
                    <div class="image-container ">
                        <img :src="portfolio.imgSrc" :alt="portfolio.portName"
                            class="object-cover object-center rounded-xl mb-4" />
                        <p class="text-white font-medium text-xl ">{{ portfolio.portName }}</p>
                        <p class="text-[#8A949C] mt-2 text-base">{{ portfolio.subTitle }}</p>
                        <!-- <p class="text-white">{{ portfolio.portName }}</p> -->
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