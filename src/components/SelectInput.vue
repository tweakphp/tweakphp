<script setup>
    import { ref, watch } from 'vue'
    import { useSettingsStore } from '@/stores/settings'

    // Define props
    const props = defineProps({
        modelValue: [String, Number],
    })

    const settingsStore = useSettingsStore()

    // Local state for the selected value
    const selectedValue = ref(props.modelValue)

    // Emit the change event to update the parent component
    const emit = defineEmits(['update:modelValue'])

    const emitChange = () => {
        emit('update:modelValue', selectedValue.value)
    }

    // Watch for changes in the prop modelValue to update the local state
    watch(
        () => props.modelValue,
        newValue => {
            selectedValue.value = newValue
        }
    )
</script>

<template>
    <select
        v-model="selectedValue"
        @change="emitChange"
        class="h-[31px] border-r-8 border-transparent py-1 px-2 outline focus:!outline-primary-500 rounded-md"
        :style="{
            backgroundColor: settingsStore.colors.backgroundLight,
            color: settingsStore.colors.foreground,
            outlineColor: settingsStore.colors.border,
        }"
    >
        <slot></slot>
    </select>
</template>
