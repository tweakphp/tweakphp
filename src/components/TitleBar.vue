<script setup>
    import { useSettingsStore } from '@/stores/settings'
    import { PlayIcon, CogIcon, ArrowPathIcon } from '@heroicons/vue/24/outline'
    import events from '@/events'
    import { useExecuteStore } from '@/stores/execute'
    import { useRoute } from 'vue-router'
    import router from '@/router'
    import VerticalSplitIcon from '@/components/icons/VerticalSplitIcon.vue'
    import HorizontalSplitIcon from '@/components/icons/HorizontalSplitIcon.vue'

    const settingsStore = useSettingsStore()
    const executeStore = useExecuteStore()
    const route = useRoute()

    const execute = () => {
        if (route.path !== '/') {
            router.push('/')
            return
        }
        events.dispatchEvent(new CustomEvent('execute', { detail: null }))
    }

    const updateLayout = layout => {
        settingsStore.settings.layout = layout
        settingsStore.update()
    }
</script>

<template>
    <div
        id="title-bar"
        class="fixed top-0 left-0 right-0 z-40 w-full h-[38px] border-b"
        :style="{
            backgroundColor: settingsStore.colors.background,
            borderColor: settingsStore.colors.border,
        }"
    >
        <div class="px-2 absolute left-0 right-0 h-full flex items-center justify-between w-full">
            <div class="flex-grow-0 w-[120px]"></div>
            <div class="flex-grow w-full drag flex items-center justify-center">TweakPHP</div>
            <div class="flex-grow-0 flex items-center">
                <template v-if="$router.currentRoute.value.name === 'code'">
                    <VerticalSplitIcon
                        @click="updateLayout('vertical')"
                        v-if="settingsStore.settings.layout === 'horizontal'"
                        class="cursor-pointer w-8 h-8 hover:!stroke-primary-500"
                    />
                    <HorizontalSplitIcon
                        @click="updateLayout('horizontal')"
                        v-if="settingsStore.settings.layout === 'vertical'"
                        class="cursor-pointer w-8 h-8 hover:!stroke-primary-500"
                    />
                </template>

                <div class="w-5 h-5">
                    <ArrowPathIcon
                        v-if="executeStore.executing"
                        :spin="true"
                        class="text-primary-500 animate-spin w-[18px] h-[18px]"
                    />
                    <PlayIcon
                        v-if="!executeStore.executing"
                        @click="execute"
                        class="w-5 h-5 cursor-pointer hover:text-primary-500"
                    />
                </div>
                <CogIcon
                    @click="$router.push('/settings')"
                    class="w-5 h-5 cursor-pointer ml-1 hover:text-primary-500"
                />
            </div>
        </div>
    </div>
</template>

<style scoped>
    .drag {
        -webkit-app-region: drag;
    }
</style>
