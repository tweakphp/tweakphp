<script setup>
    import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
    import { useExecuteStore } from '@/stores/execute'
    import { useTabsStore } from '@/stores/tabs'
    import { XMarkIcon, PlusIcon } from '@heroicons/vue/24/outline'
    import HomeView from '@/views/HomeView.vue'
    import Container from '@/components/Container.vue'
    import events from '@/events'
    import { useSettingsStore } from '@/stores/settings'
    import Editor from '@/components/Editor.vue'
    import { useRoute } from 'vue-router'
    import router from '@/router/index.js'

    const settingsStore = useSettingsStore()
    const executeStore = useExecuteStore()
    const tabsStore = useTabsStore()
    const codeEditor = ref(null)
    const resultEditor = ref(null)
    const tab = ref({})
    const route = useRoute()

    const keydownListener = event => {
        if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
            if (event.key === 'r') {
                event.preventDefault()
                if (tab.value.type === 'code') {
                    executeHandler()
                }
            }

            if (event.key === 't') {
                event.preventDefault()
                addTab()
            }

            if (event.key === 'w') {
                event.preventDefault()
                removeTab(tab.value.id)
            }
        }
    }

    const executeReplyListener = e => {
        tab.value.result = e.detail
        resultEditor.value.updateValue(e.detail)
        tabsStore.updateTab(tab.value)
        executeStore.setExecuting(false)
    }

    const infoReplyListener = e => {
        tab.value.info = JSON.parse(e.detail)
        tabsStore.updateTab(tab.value)
    }

    const executeHandler = () => {
        executeStore.setExecuting(true)
        window.ipcRenderer.send('client.execute', {
            php: settingsStore.settings.php,
            code: tab.value.code,
            path: tab.value.path,
        })
    }

    const infoHandler = () => {
        if (tab.value.type === 'code' && tab.value.info.name === '') {
            window.ipcRenderer.send('client.info', {
                php: settingsStore.settings.php,
                path: tab.value.path,
            })
        }
    }

    onMounted(async () => {
        let currentTab = tabsStore.findTab(route.params.id)
        if (currentTab.id !== parseInt(route.params.id)) {
            await router.replace({ name: 'code', params: { id: currentTab.id } })
        } else {
            tab.value = currentTab

            infoHandler()

            // add keyboard listener
            window.addEventListener('keydown', keydownListener)

            // add execute reply listener
            events.addEventListener('execute', executeHandler)

            // add execute listener
            events.addEventListener('client.execute.reply', executeReplyListener)

            // add info listener
            events.addEventListener('client.info.reply', infoReplyListener)
        }
    })

    onBeforeUnmount(async () => {
        // remove keyboard listener
        window.removeEventListener('keydown', keydownListener)

        // remove execute reply listener
        events.removeEventListener('client.execute.reply', executeReplyListener)

        // remove info listener
        events.removeEventListener('client.info.reply', infoReplyListener)

        // remote execute listener
        events.removeEventListener('execute', executeHandler)
    })

    watch(
        () => tab.value.code,
        () => {
            tabsStore.updateTab(tab.value)
        }
    )

    watch(
        () => tabsStore.tabs.length,
        async () => {
            await nextTick()
            infoHandler()
        }
    )

    watch(
        () => tab.value.type,
        async () => {
            await nextTick()
            infoHandler()
        }
    )

    const removeTab = async t => {
        let activeTab = tabsStore.removeTab(t.id)
        await router.replace({ name: 'code', params: { id: activeTab.id } })
    }

    const addTab = async () => {
        let activeTab = tabsStore.addTab()
        await router.replace({ name: 'code', params: { id: activeTab.id } })
    }
</script>

<template>
    <Container v-if="tab && route.params.id" class="pt-[38px]">
        <div
            class="min-w-full overflow-x-auto absolute top-[38px] flex h-7 border-b"
            :style="{
                backgroundColor: settingsStore.colors.background,
                borderColor: settingsStore.colors.border,
            }"
        >
            <div
                class="min-w-[120px] flex-none h-full border-r flex items-center justify-between"
                :style="{
                    borderColor: settingsStore.colors.border,
                    backgroundColor:
                        t.id === tab.id ? settingsStore.colors.backgroundLight : settingsStore.colors.background,
                }"
                v-for="t in tabsStore.tabs"
                @mousedown.middle="removeTab(t)"
            >
                <button
                    class="h-full w-full flex items-center px-2 text-xs cursor-pointer"
                    @click="router.replace({ name: 'code', params: { id: t.id } })"
                >
                    {{ t.name }}
                </button>
                <button class="h-full w-6 flex flex-none items-center justify-center" @click="removeTab(t)">
                    <XMarkIcon class="w-4 h-4" />
                </button>
            </div>
            <button class="h-full w-6 flex items-center justify-center" @click="addTab()">
                <PlusIcon class="w-4 h-4" />
            </button>
        </div>
        <div
            v-if="tab.type === 'code'"
            class="w-full h-full pt-[28px]"
            :class="{
                'flex': settingsStore.settings.layout === 'vertical',
                'flex-col': settingsStore.settings.layout === 'horizontal',
            }"
        >
            <Editor
                :key="`code-${tab.id}`"
                ref="codeEditor"
                :editor-id="`${tab.id}-${Date.now()}-code`"
                v-model:value="tab.code"
                language="php"
                :wrap="true"
                :style="{
                    height: settingsStore.settings.layout === 'horizontal' ? '50%' : '100%',
                    borderColor: settingsStore.colors.border,
                }"
                :class="{
                    'border-b': settingsStore.settings.layout === 'horizontal',
                    'border-r': settingsStore.settings.layout === 'vertical',
                }"
                :path="tab.path"
                :auto-focus="true"
            />
            <Editor
                :key="`result-${tab.id}`"
                ref="resultEditor"
                :editor-id="`${tab.id}-result`"
                v-model:value="tab.result"
                language="json"
                :readonly="true"
                :wrap="true"
                :style="{
                    height: settingsStore.settings.layout === 'horizontal' ? '50%' : '100%',
                }"
            />
            <div
                v-if="tab.info"
                class="pl-12 fixed bottom-0 left-0 right-0 border-t z-10 h-6 flex items-center justify-between text-xs"
                :style="{
                    borderColor: settingsStore.colors.border,
                    backgroundColor: settingsStore.colors.background,
                }"
            >
                <div class="px-2">PHP {{ tab.info.php_version }}</div>
                <div class="px-2">{{ tab.info.name }} {{ tab.info.version }}</div>
            </div>
        </div>
        <div v-if="tab.type === 'home'" class="w-full h-full pt-[28px]">
            <HomeView :key="`home-${tab.id}`" :tab="tab" />
        </div>
    </Container>
</template>
