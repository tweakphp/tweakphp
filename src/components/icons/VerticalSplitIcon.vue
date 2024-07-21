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
        fill="current"
    >
        <path d="M12 3h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-9" fill="none"></path>
        <path
            d="M3 17V5a2 2 0 0 1 2-2h7a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2Z"
        ></path>
    </svg>
</template>

<style scoped></style>
