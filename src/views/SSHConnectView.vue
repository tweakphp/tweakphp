<script setup>
    import Container from '@/components/Container.vue'
    import Title from '@/components/Title.vue'
    import Divider from '@/components/Divider.vue'
    import TextInput from '@/components/TextInput.vue'
    import { ref } from 'vue'
    import PrimaryButton from '@/components/PrimaryButton.vue'
    import SelectInput from '@/components/SelectInput.vue'
    const form = ref({
        host: '',
        port: '',
        auth_type: 'password',
        username: '',
        password: '',
        key: '',
    })
</script>

<template>
    <Container class="pt-[38px]">
        <div class="max-w-xl mx-auto p-10 space-y-3">
            <div class="flex items-center justify-between">
                <Title>Connect to SSH</Title>
            </div>
            <Divider />
            <div class="grid grid-cols-2 items-center">
                <div>Host</div>
                <TextInput id="host" v-model="form.host" />
            </div>
            <Divider />
            <div class="grid grid-cols-2 items-center">
                <div>Port</div>
                <TextInput id="port" v-model="form.port" />
            </div>
            <Divider />
            <div class="grid grid-cols-2 items-center">
                <div>Authentication Type</div>
                <SelectInput id="auth-type" v-model="form.auth_type">
                    <option value="password">Password</option>
                    <option value="key">Private Key</option>
                </SelectInput>
            </div>
            <Divider />
            <div class="grid grid-cols-2 items-center">
                <div>Username</div>
                <TextInput id="username" v-model="form.username" />
            </div>
            <Divider />
            <div
                v-if="form.auth_type === 'password'"
                class="grid grid-cols-2 items-center"
            >
                <div>Password</div>
                <TextInput id="password" v-model="form.password" />
            </div>
            <div
                v-if="form.auth_type === 'key'"
                class="grid grid-cols-2 items-center"
            >
                <div>Private Key Path</div>
                <TextInput id="key" v-model="form.key" />
            </div>
            <Divider />
            <div class="flex items-center justify-end">
                <PrimaryButton>Connect</PrimaryButton>
            </div>
        </div>
    </Container>
</template>

<style scoped></style>
