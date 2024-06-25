<script setup>
import { ref, onMounted, watch } from 'vue'
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

onMounted(() => {
    window.scrollTo(0, 0);
});


const portfolios = ref([
    {
        portId: 1,
        portName: 'MOD RIDE - Ride Sharing in KMUTT',
        category: 'UX/UI',
        imgSrc: mrImg,
        subTitle: 'Capstone Project 2023 - 2024'
    },
    {
        portId: 2,
        portName: 'eKYC Web Application',
        category: 'UX/UI',
        imgSrc: ekycImg,
        subTitle: 'UX/UI Design Internship 2023'
    },
    {
        portId: 3,
        portName: 'Case Keeper Dashboard',
        category: 'UX/UI',
        imgSrc: caseKeeperImg,
        subTitle: 'UX/UI Design Internship 2023'
    },
    {
        portId: 4,
        portName: 'Dip Chip Rider',
        category: 'UX/UI',
        imgSrc: dipChipImg,
        subTitle: 'UX/UI Design Internship 2023'
    },
    {
        portId: 5,
        portName: 'Hotel Check-in Kiosk',
        category: 'UX/UI',
        imgSrc: hotelKioskImg,
        subTitle: 'UX/UI Design Internship 2023'
    },
    {
        portId: 6,
        portName: 'e-Book & Scratch Game',
        category: 'Other',
        imgSrc: eBook,
        subTitle: 'The Philosophy of Sufficiency Economy Project 2023'
    },
    {
        portId: 7,
        portName: 'OASIP',
        category: 'Web Dev',
        imgSrc: oasipImg,
        subTitle: 'IT Integrated Project 2022'
    },
    {
        portId: 8,
        portName: 'ABCWishYourGrade',
        category: 'Web Dev',
        imgSrc: abcImg,
        subTitle: 'Client-side Web Programming Project 2022'
    },

    {
        portId: 10,
        portName: 'WaterMap',
        category: 'UX/UI',
        imgSrc: waterMapImg,
        subTitle: 'User Experience Design Project 2020'
    },
    {
        portId: 11,
        portName: 'Portfolio Website',
        category: 'Web Dev',
        imgSrc: portWebImg,
        subTitle: 'Web Technology Project 2020'
    },
    {
        portId: 12,
        portName: 'Ricardo Your Hero',
        category: 'Other',
        imgSrc: ricardoImg,
        subTitle: 'Scratch Game Dev 2019'
    }
])

// Filtered portfolios based on the selected category
const filteredPortfolios = ref(portfolios.value)

// Active filter category
const activeFilter = ref('All')

// Method to filter portfolios based on the selected category
const filterPortfolios = (category) => {
    activeFilter.value = category // Update active filter
    if (category === 'All') {
        // If 'All' is selected, display all portfolios
        filteredPortfolios.value = portfolios.value
    } else {
        // Otherwise, filter portfolios based on the selected category
        filteredPortfolios.value = portfolios.value.filter(portfolio => portfolio.category === category)
    }

    // Trigger the fade-up animation
    const container = document.querySelector('.fade-in-up');
    container.classList.remove('fade-in-up');
    void container.offsetWidth; // Trigger reflow
    container.classList.add('fade-in-up');
}
console.log(portfolios.value[5].imgSrc);


</script>

<template>
    <div class="">
        <div class="mx-auto max-w-screen-lg min-h-screen mb-6">
            <div class="w-full mt-10 flex ">
                <h1 class="mx-auto font-bold text-4xl text-white">Works</h1>
            </div>

            <!-- Filter Menu -->
            <div class="flex justify-center mt-4">
                <div class="p-2 rounded-full flex space-x-4">
                    <button @click="filterPortfolios('All')"
                        :class="['px-4 py-2 rounded-xl font-bold text-base transition-colors', { 'bg-white text-[#141414]': activeFilter === 'All', 'text-white bg-[#191919] hover:bg-[#272727]': activeFilter !== 'All' }]">
                        All
                    </button>
                    <button @click="filterPortfolios('UX/UI')"
                        :class="['px-4 py-2 rounded-xl font-bold text-base transition-colors', { 'bg-white text-[#141414]': activeFilter === 'UX/UI', 'text-white bg-[#191919] hover:bg-[#272727]': activeFilter !== 'UX/UI' }]">
                        UX/UI
                    </button>
                    <button @click="filterPortfolios('Web Dev')"
                        :class="['px-4 py-2 rounded-xl font-bold text-base transition-colors', { 'bg-white text-[#141414]': activeFilter === 'Web Dev', 'text-white bg-[#191919] hover:bg-[#272727]': activeFilter !== 'Web Dev' }]">
                        Web Dev
                    </button>
                    <button @click="filterPortfolios('Other')"
                        :class="['px-4 py-2 rounded-xl font-bold text-base transition-colors', { 'bg-white text-[#141414]': activeFilter === 'Other', 'text-white bg-[#191919] hover:bg-[#272727]': activeFilter !== 'Other' }]">
                        Other
                    </button>
                </div>
            </div>

            <!-- Portfolio Grid -->
            <div class="fade-in-up grid grid-cols-12 gap-6 mt-8 mx-6 ">
                <div v-for="portfolio in filteredPortfolios" :key="portfolio.portId" class="col-span-12 md:col-span-6 rounded-xl mb-4 
                    transition-colors duration-300 ease-in-out hover:bg-[#1F1F1F] px-1 py-1 ">
                    <router-link :to="{ name: 'PortfolioDetails', params: { portId: portfolio.portId } }">

                        <div class="image-container">
                            <img :src="portfolio.imgSrc" :alt="portfolio.portName"
                                class="object-cover object-center rounded-xl mb-4" />
                            <p class="text-white font-medium text-xl">{{ portfolio.portName }}</p>
                            <p class="text-[#8A949C] mt-2 text-base">{{ portfolio.subTitle }}</p>
                        </div>
                    </router-link>
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