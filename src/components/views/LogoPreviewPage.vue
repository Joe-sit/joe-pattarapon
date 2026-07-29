<script setup>
import { onMounted } from 'vue'
import JoeConfigMotion from '../JoeConfigMotion.vue'
import JoeLettersMotion from '../JoeLettersMotion.vue'

onMounted(() => {
    window.scrollTo(0, 0)
})
</script>

<template>
    <div class="mx-auto max-w-screen-lg min-h-screen px-4 mb-6">

        <div class="mt-10 mb-8 fade-in-up">
            <h1 class="font-bold text-4xl text-[#1c1c1c]">Logo Preview</h1>
            <p class="text-[#8A949C] mt-3 text-base max-w-lg">
                A live preview of the new JOE logo and its animation.
            </p>
        </div>

        <div class="flex flex-col gap-10 fade-in-up">

            <div>
                <p class="text-[#8A949C] text-sm mb-2">Config version</p>
                <div class="rounded-2xl overflow-hidden border border-black/5">
                    <JoeConfigMotion />
                </div>
            </div>

            <div>
                <p class="text-[#8A949C] text-sm mb-2">Letters version (E only)</p>
                <div class="rounded-2xl overflow-hidden border border-black/5">
                    <JoeLettersMotion />
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
