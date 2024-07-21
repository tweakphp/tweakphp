<script setup>
    import { useSettingsStore } from '@/stores/settings'
    import { computed } from 'vue'

    const settingsStore = useSettingsStore()

    const props = defineProps({
        class: {
            type: String,
            default: '',
        },
    })

    const classes = computed(() => {
        return `w-full h-full ${props.class}`
    })
</script>

<template>
    <div
        :class="classes"
        :style="{ backgroundColor: settingsStore.colors.background }"
    >
        <slot></slot>
    </div>
</template>
