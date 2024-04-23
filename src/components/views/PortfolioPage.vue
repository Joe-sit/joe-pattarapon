<script setup>
import { ref, onMounted } from 'vue'



const portfolios = ref([
    { portId: 1, portName: 'MODRIDE', category: 'UX/UI' },
    { portId: 2, portName: 'MODRIDE2', category: 'Web Dev' },
    { portId: 3, portName: 'MODRID3E', category: 'Data Analytics' },
])
</script>

<template>
    <div class="">
        <div class="fade-in-up mx-auto max-w-screen-lg min-h-screen mb-6 border">
            <div class="w-full mt-10 flex ">
                <h1 class="mx-auto font-bold text-4xl text-white">Portfolio</h1>
            </div>

            <!--Filter Menu-->
            <div class="mx-6 mt-6">
                <div class="grid grid-cols-4 gap-4 ">

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