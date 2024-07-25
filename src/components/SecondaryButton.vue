<script setup>
    import { computed } from 'vue'
    import { useSettingsStore } from '@/stores/settings'

    const props = defineProps({
        class: {
            type: String,
            default: '',
        },
    })

    const settingsStore = useSettingsStore()

    const classes = computed(() => {
        let defaultClasses =
            'inline-flex h-8 text-sm w-max min-w-max items-center justify-center rounded-md border border bg-transparent px-4 py-1 text-white outline-0 transition hover:bg-opacity-50 focus:ring focus:ring-opacity-50 disabled:opacity-25'
        return `${defaultClasses} ${props.class}`
    })
</script>

<template>
    <button :class="classes" :style="{ borderColor: settingsStore.colors.borderColor }">
        <slot></slot>
    </button>
</template>

<style scoped></style>
