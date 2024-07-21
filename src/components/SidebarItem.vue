<script setup>
    import { useSettingsStore } from '@/stores/settings'

    const props = defineProps({
        active: {
            type: Boolean,
            default: false,
        },
    })

    const settingsStore = useSettingsStore()
</script>

<template>
    <div
        class="flex items-center justify-center p-3 border-b hover:text-primary-500"
        :class="{
            'text-primary-500': props.active,
        }"
        :style="{
            borderColor: settingsStore.colors.border,
            color: !props.active ? settingsStore.colors.foreground : null,
        }"
    >
        <slot></slot>
    </div>
</template>
