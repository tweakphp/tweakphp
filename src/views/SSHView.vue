<script setup>
    import Container from '@/components/Container.vue'
    import Title from '@/components/Title.vue'
    import PrimaryButton from '@/components/PrimaryButton.vue'
    import { PlusIcon } from '@heroicons/vue/24/outline'
</script>

<template>
    <Container class="pt-[38px]">
        <div class="flex items-center justify-between max-w-xl mx-auto p-10">
            <Title>SSH Connections</Title>
            <PrimaryButton @click="$router.push('/ssh/connect')">
                <PlusIcon class="w-4 h-4" />
            </PrimaryButton>
        </div>
    </Container>
</template>

<style scoped></style>
