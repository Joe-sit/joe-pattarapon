<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router';
import ModRideDetails from './ModRideDetails.vue';
import EkycDetails from './EkycDetails.vue';
import CaseKeeperDetails from './CaseKeeperDetails.vue';
import DipChipDetails from './DipChipDetails.vue';
import KioskDetails from './KioskDetails.vue';
import eBookDetails from './eBookDetails.vue';
import OASIPDetails from './OASIPDetails.vue';
import AbcDetails from './AbcDetails.vue';
import WaterMapDetails from './WaterMapDetails.vue';
import PortWebDetails from './PortWebDetails.vue';
import RicardoDetails from './RicardoDetails.vue';
import CustomerDetails from './CustomerDetails.vue';


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
import GoToSVG from '../../assets/bubble.svg'
import SuggestedPortfolios from './SuggestedPortfolios.vue';


onMounted(() => {
    window.scrollTo(0, 0);
});


const { params } = useRoute()


import { getRandomPortfolios } from '../../utils/portfolioUtils.js';

// Get the current route
const route = useRoute();

// Extract the portId from the route
const portId = ref(Number(route.params.portId));

// Watch for changes in the route parameters
watch(() => route.params.portId, (newId) => {
    portId.value = Number(newId);
    // Perform any additional actions needed to fetch or update portfolio details
    window.scrollTo(0, 0); // Scroll to the top when portId changes
    console.log("watch activated");
    window.location.reload();





});


const suggestedPortfolios = ref([]);

let currentPortfolioId = portId.value

onMounted(() => {
    const portfolios = [
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

    suggestedPortfolios.value = getRandomPortfolios(portfolios, currentPortfolioId);

    console.log('Suggested Portfolios:', suggestedPortfolios.value);

});

console.log(params);

console.log("currentPortID", currentPortfolioId);


console.log("portID", portId.value);

</script>

<template>
    <div class="fade-in-up mx-auto max-w-screen-lg min-h-screen mb-6 ">
        <!-- <p class="text-black">Portfolio ID: {{ portId }}</p> -->

        <div class="mt-10 flex mx-6 ">
            <div v-if="portId == 1" class="w-full">
                <ModRideDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>
            <div v-else-if="portId == 2" class="w-full">
                <EkycDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>
            <div v-else-if="portId == 3" class="w-full">
                <CaseKeeperDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>
            <div v-else-if="portId == 4" class="w-full">
                <DipChipDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>

            <div v-else-if="portId == 5" class="w-full">
                <KioskDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>

            <div v-else-if="portId == 6" class="w-full">
                <eBookDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>

            <div v-else-if="portId == 7" class="w-full">
                <OASIPDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>

            <div v-else-if="portId == 8" class="w-full">
                <AbcDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>

            <div v-else-if="portId == 10" class="w-full">
                <CustomerDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>

            <div v-else-if="portId == 11" class="w-full">
                <WaterMapDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>

            <div v-else-if="portId == 12" class="w-full">
                <PortWebDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>

            <div v-else-if="portId == 13" class="w-full">
                <RicardoDetails />

                <SuggestedPortfolios :currentPortfolioId="portId" />

            </div>



            <!-- More portfolio details components -->

            <div v-else class="w-full">
                <p class="text-white mt-10 flex justify-center">Coming Soon Jaa...</p>
                <img src="https://media1.tenor.com/m/LJ8is9KE6C0AAAAd/pedro-racoon.gif" alt="Racoon Dance"
                    class="rounded-full w-40 h-40 object-cover flex mx-auto mt-10">
            </div>
        </div>
    </div>
</template>


<style></style>