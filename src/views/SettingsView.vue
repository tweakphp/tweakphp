<script setup>
import Container from '@/components/Container.vue'
import Title from '@/components/Title.vue'
import Divider from '@/components/Divider.vue'
import { useSettingsStore } from '@/stores/settings'
import SelectInput from '@/components/SelectInput.vue'
import TextInput from '@/components/TextInput.vue'
import PrimaryButton from '@/components/PrimaryButton.vue'
import { SparklesIcon } from '@heroicons/vue/24/outline'
const settingsStore = useSettingsStore()

const saveSettings = () => {
    settingsStore.update()
}

const fixedPhpPath = async () => {
    window.ipcRenderer.send('php.path', {
        type: 'FIXED'
    })
}

</script>

<template>
    <Container class="pt-[38px]">
        <div class="max-w-xl p-10 mx-auto">
            <Title>Settings</Title>
            <Divider class="mt-3" />
            <div class="grid items-center grid-cols-2 mt-3">
                <div class="flex justify-between pr-3">
                    PHP path
                    <PrimaryButton title="Fix PHP path" @click="fixedPhpPath()">
                        <SparklesIcon class="size-4" />
                    </PrimaryButton>
                </div>
                <TextInput id="php" v-model="settingsStore.settings.php" @change="saveSettings()" />
            </div>
            <Divider class="mt-3" />
            <div class="grid items-center grid-cols-2 mt-3">
                <div>Theme</div>
                <SelectInput id="theme" v-model="settingsStore.settings.theme" @change="saveSettings()">
                    <option v-for="theme in settingsStore.themes" :value="theme">
                        {{ theme }}
                    </option>
                </SelectInput>
            </div>
            <Divider class="mt-3" />
            <div class="grid items-center grid-cols-2 mt-3">
                <div>Editor font size</div>
                <TextInput id="editor-font-size" v-model="settingsStore.settings.editor.fontSize"
                    @change="saveSettings()" />
            </div>
            <Divider class="mt-3" />
            <div class="grid items-center grid-cols-2 mt-3">
                <div>Editor word wrap</div>
                <SelectInput id="editor-word-wrap" v-model="settingsStore.settings.editor.wordWrap"
                    @change="saveSettings()">
                    <option value="on">Wrap</option>
                    <option value="off">No Wrap</option>
                </SelectInput>
            </div>
        </div>
    </Container>
</template>

<style scoped></style>
