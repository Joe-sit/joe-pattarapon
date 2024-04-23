<script setup>
import { ref } from 'vue'

const portfolios = ref([
    { portId: 1, portName: 'MODRIDE' },
    { portId: 2, portName: 'MODRIDE2' },
    { portId: 3, portName: 'MODRID3E' },
])
</script>

<template>
    <div v-for="portfolio in portfolios" :key="portfolio.id">
        {{ portName }}

    </div>

</template>

<style></style>