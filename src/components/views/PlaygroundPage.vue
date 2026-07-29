<script setup>
import { onMounted } from 'vue'
import JoeAnimated from '../JoeAnimated.vue'

onMounted(() => {
    window.scrollTo(0, 0)
})
</script>

<template>
    <div class="mx-auto max-w-screen-lg min-h-screen px-4 mb-6">

        <!-- Header -->
        <div class="mt-10 mb-8 fade-in-up">
            <h1 class="font-bold text-4xl text-[#1c1c1c]">Playground</h1>
            <p class="text-[#8A949C] mt-3 text-base max-w-lg">
                A space for experiments, interactive demos, and creative coding ideas.
            </p>
        </div>

        <!-- Experiments -->
        <div class="flex flex-col gap-6 fade-in-up">

            <!-- JOE Logo Animation -->
            <div class="rounded-2xl bg-white border border-black/5 overflow-hidden">
                <JoeAnimated />
                <div class="px-5 py-4 flex flex-col gap-2">
                    <div class="flex items-center justify-between flex-wrap gap-2">
                        <h2 class="font-semibold text-[#1c1c1c] text-base">JOE — Logo Morph Animation</h2>
                        <div class="flex flex-wrap gap-1.5">
                            <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#FF6A00]/10 text-[#FF6A00] font-medium">GSAP</span>
                            <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#FF6A00]/10 text-[#FF6A00] font-medium">SVG</span>
                            <span class="text-xs px-2.5 py-0.5 rounded-full bg-[#FF6A00]/10 text-[#FF6A00] font-medium">MorphSVG</span>
                        </div>
                    </div>
                    <p class="text-[#8A949C] text-sm leading-relaxed">
                        Each letter assembles from abstract geometric shapes and morphs into its final form using GSAP MorphSVGPlugin.
                    </p>
                </div>
            </div>

        </div>
    </div>
</template>

<style scoped>
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

.fade-in-up {
    animation: fade-in-up 0.5s ease-in-out;
}
</style>
