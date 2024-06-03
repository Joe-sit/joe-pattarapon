<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter, } from 'vue-router';
import mrImg from '../../assets/portfolios/MODRIDE.png'
import ekycImg from '../../assets/portfolios/eKyc.png'
import caseKeeperImg from '../../assets/portfolios/case-keeper.png'
import dipChipImg from '../../assets/portfolios/dip-chip.png'
import hotelKioskImg from '../../assets/portfolios/hotel-kiosk.png'
import eBook from '../../assets/portfolios/Ebook2.jpg'
import oasipImg from '../../assets/portfolios/oasip.png'
import abcImg from '../../assets/portfolios/abcWishYourGrade.png'
import customerImg from '../../assets/portfolios/customer-personality-analysis.png'
import waterMapImg from '../../assets/portfolios/water-map.png'
import portWebImg from '../../assets/portfolios/first-portfolio-web.png'
import ricardoImg from '../../assets/portfolios/ricardo-game.png'
import PortfolioDetails from './PortfolioDetails.vue'
import externalSVG from '../../assets/arrow-square-out.svg'
import backSVG from '../../assets/arrow-left.svg'

const data = ref([
    {
        portId: 2,
        portName: 'eKYC Web Application',
        category: 'UX/UI',
        imgSrc: ekycImg,
        subTitle: 'UX/UI Design Internship'
    }
])

const portName = ref(data.value[0].portName)
const subTitle = ref(data.value[0].subTitle)


const router = useRouter();

const goToPortfolioPage = () => {
    router.push({ name: 'Portfolio' });
}

console.log(subTitle.value);

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

                    <h1 class="text-[#8A949C] text-base font-medium mt-6 mx-6 ">COMPANY</h1>
                    <a href="https://www.appman.co.th/" target="_blank"
                        class="text-[#F2F2F2] text-base font-medium mt-4 mx-6 inline-flex items-center">
                        AppMan Co., Ltd.
                        <externalSVG class="ml-2 inline-block fill-white w-6 h-6 " />
                    </a>


                    <h1 class="text-[#8A949C] text-base font-medium mt-8 mx-6 ">MY ROLE</h1>
                    <p class="text-[#F2F2F2] text-base font-medium mt-4 mx-6 ">UX/UI Designer</p>

                    <h1 class="text-[#8A949C] text-base font-medium mt-8 mx-6 ">FEATURES</h1>
                    <p class="text-[#F2F2F2] text-base font-medium mt-4 mx-6 ">EKYC, Face Recognition</p>

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

                    <p class="text-[#F2F2F2] text-base font-medium mt-4 mx-4 ">Providing job seekers with the ability to
                        search, explore, and discover
                        suitable job postings based on their individual preferences and criteria,
                        the job portal app enables job seekers to take a more proactive and
                        informed approach to their job search process.</p>
                </div>

            </div>
        </div>
    </div>









</template>

<style></style>