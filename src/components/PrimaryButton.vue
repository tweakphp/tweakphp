<script setup>
    import { computed } from 'vue'

    const props = defineProps({
        class: {
            type: String,
            default: '',
        },
    })

    const classes = computed(() => {
        let defaultClasses =
            'inline-flex h-8 text-sm w-max min-w-max items-center justify-center rounded-md border border-transparent bg-primary-600 px-4 py-1 text-white outline-0 transition hover:bg-primary-700 focus:border-primary-300 focus:border-primary-700 focus:ring active:bg-primary-700 disabled:opacity-25 focus:border-primary-700 focus:ring-primary-700 focus:ring-opacity-40'
        return `${defaultClasses} ${props.class}`
    })
</script>

<template>
    <button :class="classes">
        <slot></slot>
    </button>
</template>

<style scoped></style>
