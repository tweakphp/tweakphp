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
        let defaultClasses = 'h-[1px] border-t'
        return `${defaultClasses} ${props.class}`
    })
</script>

<template>
    <div
        :class="classes"
        :style="{ borderColor: settingsStore.colors.border }"
    ></div>
</template>

<style scoped></style>
