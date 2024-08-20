<script setup>
import { ref, onMounted } from 'vue';
import GoToSVG from '../../assets/bubble.svg';
import { getRandomPortfolios } from '../../utils/portfolioUtils.js';


// import portfolio images
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

// Props
const props = defineProps({
    currentPortfolioId: {
        type: Number,
        required: true,
    },
});

const suggestedPortfolios = ref([]);

// Portfolio data
const portfolios =
    [
        {
            id: 1, name: 'MOD RIDE - Ride Sharing in KMUTT',
            imgSrc: mrImg,
            subTitle: 'Capstone Project 2023 - 2024'
        },
        {
            id: 2, name: 'eKYC Web Application',
            imgSrc: ekycImg,
            subTitle: 'UX/UI Design Internship 2023'
        },
        {
            id: 3, name: 'Case Keeper Dashboard',
            imgSrc: caseKeeperImg,
            subTitle: 'UX/UI Design Internship 2023'
        },
        {
            id: 4, name: 'Dip Chip Rider',
            imgSrc: dipChipImg,
            subTitle: 'UX/UI Design Internship 2023'
        },
        {
            id: 5, name: 'Hotel Check-in Kiosk',
            imgSrc: hotelKioskImg,
            subTitle: 'UX/UI Design Internship 2023'
        },
        {
            id: 6, name: 'e-Book & Scratch game',
            imgSrc: eBook,
            subTitle: 'The Philosophy of Sufficiency Economy Project 2023'
        },
        {
            id: 7, name: 'OASIP',
            imgSrc: oasipImg,
            subTitle: 'IT Integrated Project 2022'
        },
        {
            id: 8, name: 'ABCWishYourGrade',
            imgSrc: abcImg,
            subTitle: 'Client-side Web Programming Project 2022'
        },
        {
            id: 10, name: 'Customer Personality Analytics',
            imgSrc: customerImg,
            subTitle: 'Statistics for IT Project 2021'
        },
        {
            id: 11, name: 'WaterMap',
            imgSrc: waterMapImg,
            subTitle: 'User Experience Design Project 2020'
        },
        {
            id: 12, name: 'Portfolio Website',
            imgSrc: portWebImg,
            subTitle: 'Web Technology Project 2020'
        },
        {
            id: 13, name: 'Ricard Your Hero',
            imgSrc: ricardoImg,
            subTitle: 'Scratch Game Dev 2019'
        }
        // Add all your portfolio items here
    

];

onMounted(() => {
    suggestedPortfolios.value = getRandomPortfolios(portfolios, props.currentPortfolioId);
});
</script>


<!-- SuggestedPortfolios.vue -->
<template>
    <div v-if="suggestedPortfolios.length" class="border-t-2 mt-16 mb-6">
        <div class="mt-10 flex justify-between">
            <h1 class="text-[#1c1c1c] text-lg sm:text-xl font-bold mb-6">Where should I go next?</h1>
            <router-link :to="{ name: 'Portfolio' }"
                class="text-[#2F80ED] text-lg sm:text-base font-light hover:underline">
                See all
            </router-link>
        </div>
        <div class="fade-in-up grid grid-cols-12 gap-6">
            <div v-for="portfolio in suggestedPortfolios" :key="portfolio.id" class="col-span-12 md:col-span-6">
                <router-link :to="{ name: 'PortfolioDetails', params: { portId: portfolio.id } }"
                    class="flex col-span-1 rounded-xl mb-4 group transition-all duration-500 hover:-translate-y-2 px-2 py-2 hover:bg-slate-100"
                    >
                    <div class="image-container relative">
                        <img :src="portfolio.imgSrc" :alt="portfolio.name"
                            class="object-cover object-center rounded-xl border mb-4" />
                        <p class="text-[#1c1c1c] font-medium text-xl ml-2">{{ portfolio.name }}</p>
                        <p class="text-[#8A949C] rounded-xl mt-2 ml-2 mb-2 text-base">{{ portfolio.subTitle }}</p>
                        <button
                            class="w-8 h-8 flex items-center absolute top-0 right-0 m-4 overflow-hidden justify-center rounded-full bg-white group transition-all duration-500 hover:-translate-y-2">
                            <GoToSVG class="transition-all duration-500 group-hover:fill-white" viewBox="0 0 24 24" />
                        </button>
                    </div>
                </router-link>
            </div>
        </div>
    </div>
</template>



<style scoped></style>