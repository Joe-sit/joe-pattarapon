<script setup>
import { ref, onMounted } from 'vue'
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



onMounted(() => {
    window.scrollTo(0, 0);
});


const { params } = useRoute()
const portId = params.portId;


console.log(params);

console.log("portID", portId);
// const getDetailComponentName = (portId) => {
//     switch (portId) {
//         case 1:
//             return 'ModRideDetails';

//         case 2:
//             return 'EkycDetails'
//         // Add cases for other portfolio items
//         default:
//             return 'NotFoundDetails';
//     }

// };
</script>

<template>
    <div class="fade-in-up mx-auto max-w-screen-lg min-h-screen mb-6 ">
        <div class="mt-10 flex mx-6 ">
            <div v-if="portId == 1" class="w-full">
                <ModRideDetails />
            </div>
            <div v-else-if="portId == 2" class="w-full">
                <EkycDetails />
            </div>
            <div v-else-if="portId == 3" class="w-full">
                <CaseKeeperDetails />
            </div>
            <div v-else-if="portId == 4" class="w-full">
                <DipChipDetails />
            </div>

            <div v-else-if="portId == 5" class="w-full">
                <KioskDetails />
            </div>

            <div v-else-if="portId == 6" class="w-full">
                <eBookDetails />
            </div>

            <div v-else-if="portId == 7" class="w-full">
                <OASIPDetails />
            </div>


            <div v-else-if="portId == 8" class="w-full">
                <AbcDetails />
            </div>

            <div v-else-if="portId == 10" class="w-full">
                <WaterMapDetails />
            </div>




            <!-- 
            
            <div v-else-if="portId == 7" class="w-full">
                <OASIPDetails />
            </div>
            <div v-else-if="portId == 8" class="w-full">
                <AbcDetails />
            </div>
           
            <div v-else-if="portId == 11" class="w-full">
                <PortWebDetails />
            </div>
            <div v-else-if="portId == 12" class="w-full">
                <RicardoDetails />
            </div> -->





            <div v-else class="w-full">
                <p class="text-white mt-10 flex justify-center">Coming Soon Jaa...</p>
                <img src="https://media1.tenor.com/m/LJ8is9KE6C0AAAAd/pedro-racoon.gif" alt="Racoob Dance"
                    class="rounded-full w-40 h-40 object-cover flex mx-auto mt-10">


            </div>


        </div>



    </div>
</template>

<style></style>