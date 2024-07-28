<script setup>
    import { RouterLink, RouterView } from 'vue-router'
    import { useColorSchemeStore } from '@/stores/color-scheme'
    import { useExecuteStore } from '@/stores/execute'
    import { ArrowPathIcon, BoltIcon, CogIcon, FolderOpenIcon } from '@heroicons/vue/24/outline'
    import SidebarItem from '@/components/SidebarItem.vue'
    import TitleBar from './components/TitleBar.vue'
    import { onMounted } from 'vue'
    import { useTabsStore } from '@/stores/tabs'
    import { useHistoryStore } from '@/stores/history'
    import router from '@/router'
    import events from '@/events'
    import { useSettingsStore } from '@/stores/settings'
    import { initServices } from 'monaco-languageclient/vscode/services'

    const colorSchemeStore = useColorSchemeStore()
    const colorSchemeSetup = () => {
        if (colorSchemeStore.isDark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }

    const executeStore = useExecuteStore()
    const tabStore = useTabsStore()
    const historyStore = useHistoryStore()
    const settingsStore = useSettingsStore()

    onMounted(async () => {
        colorSchemeSetup()
        let media = window.matchMedia('(prefers-color-scheme: dark)')
        media.addEventListener('change', () => {
            colorSchemeStore.change()
            colorSchemeSetup()
        })
        window.ipcRenderer.receive('source.open.reply', e => {
            router.push('/')
            tabStore.addTab({
                path: e,
                type: 'code',
            })
            historyStore.addHistory(e)
        })
        window.ipcRenderer.receive('client.execute.reply', e => {
            events.dispatchEvent(new CustomEvent('client.execute.reply', { detail: e }))
        })
        window.ipcRenderer.receive('client.info.reply', e => {
            events.dispatchEvent(new CustomEvent('client.info.reply', { detail: e }))
        })
        window.ipcRenderer.receive('ssh.connect.reply', e => {
            events.dispatchEvent(new CustomEvent('ssh.connect.reply', { detail: e }))
        })
        await initEditor()
    })

    const openFolder = () => {
        window.ipcRenderer.send('source.open')
    }

    const initEditor = async () => {
        await initServices({
            serviceConfig: {
                debugLogging: true,
            },
        })
    }
</script>

<template>
    <div class="h-full" :style="{ color: settingsStore.colors.foreground }">
        <TitleBar />
        <aside
            class="w-12 fixed z-40 top-[38px] left-0 bottom-0 justify-between border-r"
            :style="{
                backgroundColor: settingsStore.colors.background,
                borderColor: settingsStore.colors.border,
            }"
        >
            <div class="h-full flex flex-col justify-between">
                <div>
                    <SidebarItem :active="router.currentRoute.value.name === 'code'">
                        <RouterLink :to="router.currentRoute.value.name === 'code' ? '' : '/'">
                            <ArrowPathIcon class="w-6 h-6 animate-spin" v-if="executeStore.executing" :spin="true" />
                            <BoltIcon v-else class="w-6 h-6 hover:text-primary-500" />
                        </RouterLink>
                    </SidebarItem>
                    <SidebarItem>
                        <RouterLink to="">
                            <FolderOpenIcon @click="openFolder" class="w-6 h-6 hover:text-primary-500" />
                        </RouterLink>
                    </SidebarItem>
                    <!--                    <SidebarItem-->
                    <!--                        :active="-->
                    <!--                            router.currentRoute.value.path.includes('/ssh')-->
                    <!--                        "-->
                    <!--                    >-->
                    <!--                        <RouterLink to="/ssh">-->
                    <!--                            <WifiIcon class="w-6 h-6 hover:text-primary-500" />-->
                    <!--                        </RouterLink>-->
                    <!--                    </SidebarItem>-->
                </div>
                <div class="border-t" :style="{ borderColor: settingsStore.colors.border }">
                    <SidebarItem :active="router.currentRoute.value.path === '/settings'">
                        <RouterLink to="/settings">
                            <CogIcon class="w-6 h-6 hover:text-primary-500" />
                        </RouterLink>
                    </SidebarItem>
                </div>
            </div>
        </aside>
        <div class="h-full flex pl-12">
            <main class="w-full h-full">
                <RouterView :key="$route.fullPath" />
            </main>
        </div>
    </div>
</template>
