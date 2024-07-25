<script setup>
    import Container from '@/components/Container.vue'
    import Title from '@/components/Title.vue'
    import Divider from '@/components/Divider.vue'
    import { useSettingsStore } from '@/stores/settings'
    import SelectInput from '@/components/SelectInput.vue'
    import TextInput from '@/components/TextInput.vue'

    const settingsStore = useSettingsStore()

    const saveSettings = () => {
        settingsStore.update()
    }
</script>

<template>
    <Container class="pt-[38px]">
        <div class="max-w-xl mx-auto p-10">
            <Title>Settings</Title>
            <Divider class="mt-3" />
            <div class="mt-3 grid grid-cols-2 items-center">
                <div>PHP path</div>
                <TextInput id="php" v-model="settingsStore.settings.php" @change="saveSettings()" />
            </div>
            <Divider class="mt-3" />
            <div class="mt-3 grid grid-cols-2 items-center">
                <div>Theme</div>
                <SelectInput id="theme" v-model="settingsStore.settings.theme" @change="saveSettings()">
                    <option v-for="theme in settingsStore.themes" :value="theme">
                        {{ theme }}
                    </option>
                </SelectInput>
            </div>
            <Divider class="mt-3" />
            <div class="mt-3 grid grid-cols-2 items-center">
                <div>Editor font size</div>
                <TextInput
                    id="editor-font-size"
                    v-model="settingsStore.settings.editor.fontSize"
                    @change="saveSettings()"
                />
            </div>
            <Divider class="mt-3" />
            <div class="mt-3 grid grid-cols-2 items-center">
                <div>Editor word wrap</div>
                <SelectInput
                    id="editor-word-wrap"
                    v-model="settingsStore.settings.editor.wordWrap"
                    @change="saveSettings()"
                >
                    <option value="on">Wrap</option>
                    <option value="off">No Wrap</option>
                </SelectInput>
            </div>
        </div>
    </Container>
</template>

<style scoped></style>
