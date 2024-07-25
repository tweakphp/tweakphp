<script setup>
    import { useSettingsStore } from '@/stores/settings'

    const settingsStore = useSettingsStore()
</script>

<template>
    <svg
        viewBox="-8 -7 42 36"
        stroke-width="1.4"
        stroke-linecap="round"
        stroke-linejoin="round"
        :style="{ stroke: settingsStore.colors.foreground }"
        class="fill-transparent"
    >
        <path d="M23 11V3H3v8h20Z" stroke-width="0"></path>
        <path d="M23 17V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2ZM22 11H4" fill="none"></path>
    </svg>
</template>

<style scoped></style>
