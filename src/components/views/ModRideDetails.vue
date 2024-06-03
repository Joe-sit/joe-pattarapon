<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router';

import mrImg from '../../assets/portfolios/MODRIDE.png'
import backSVG from '../../assets/arrow-left.svg'



const data = ref([
    {
        portId: 1,
        portName: 'MOD RIDE - Ride Sharing in KMUTT',
        category: 'UX/UI',
        imgSrc: mrImg,
        subTitle: 'Capstone Project 2023 - 2024'
    }
])

const portName = ref(data.value[0].portName)
const subTitle = ref(data.value[0].subTitle)

console.log(subTitle.value);

const router = useRouter();

const goToPortfolioPage = () => {
    router.push({ name: 'Portfolio' });
}

</script>

<template>

    <div>
        <backSVG @click="goToPortfolioPage" class="cursor-pointer mb-4" />
        <!--Title-->
        <h1 class="flex mx-auto font-bold text-4xl text-[#F2F2F2]">
            {{ portName }}
        </h1>
        <!--Sub Title-->
        <p class="text-[#8A949C] mt-2 text-2xl">{{ subTitle }}</p>

        <div>
            <div class="w-full grid grid-cols-12 gap-4 mt-6">

                <!-- Column -->
                <div class="col-span-12 md:col-span-6 bg-[#101010] 
                    border border-[#ffffff]/5 rounded-xl ">

                    <h1 class="text-[#8A949C] text-base font-medium mt-6 mx-6 ">MY ROLE</h1>
                    <p class="text-[#F2F2F2] text-base font-medium mt-4 mx-6 inline-flex items-center">
                        UX/UI Design, Front-End
                        <externalSVG class="ml-2 inline-block fill-white w-6 h-6 " />
                    </p>


                    <h1 class="text-[#8A949C] text-base font-medium mt-8 mx-6 ">CORE FEATURES</h1>
                    <p class="text-[#F2F2F2] text-base font-medium mt-4 mx-6 ">
                    <ul>
                        <li>
                            • Authentication
                        </li>
                        <li>
                            • Social Network
                        </li>
                        <li>
                            • Trip Events
                        </li>
                        <li>
                            • Group Chat
                        </li>
                    </ul>
                    </p>


                    <h1 class="text-[#8A949C] text-base font-medium mt-8 mx-6 ">DURATION</h1>
                    <p class="text-[#F2F2F2] text-base font-medium mt-4 mx-6 mb-6 ">Jan. - Jun. 2023 (6 months)</p>

                </div>

                <!-- Column -->
                <div class="col-span-12 md:col-span-6 bg-[#101010] 
                    border border-[#ffffff]/5 rounded-xl px-2 py-2 ">
                    <h1 class="text-[#8A949C] text-base font-medium mt-4 mx-4 ">DESCRIPTION</h1>

                    <p class="text-[#F2F2F2] text-base font-medium mt-4 mx-4 ">An app that matches job seekers with
                        relevant postings.</p>

                    <h1 class="text-[#8A949C] text-base font-medium mt-4 mx-4 ">CONTEXT</h1>

                    <p class="text-[#F2F2F2] text-base font-medium mt-4 mx-4 mb-6">MOD RIDE is a ride sharing web application
                    which is focused on users in the KMUTT area. Who wants to find friends to travel to a similar destination.</p>
                </div>

            </div>
        </div>
    </div>








</template>

<style></style>