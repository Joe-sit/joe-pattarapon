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
                <div class="col-span-12 md:col-span-6 bg-[#1C1C1C] 
                    border border-[#ffffff]/5 rounded-xl px-6 py-6 ">
                    <h1 class="text-white">Coming soon jaaaa...</h1>
                </div>

                <!-- Column -->
                <div class="col-span-12 md:col-span-6 bg-[#1C1C1C] 
                    border border-[#ffffff]/5 rounded-xl px-6 py-6 ">
                    <h1 class="text-white">Coming soon jaaaa...</h1>
                </div>

            </div>
        </div>
    </div>








</template>

<style></style>