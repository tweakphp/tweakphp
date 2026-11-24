<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
  import { ArrowPathIcon, CommandLineIcon, ExclamationTriangleIcon } from '@heroicons/vue/24/outline'
  import Modal from '../Modal.vue'
  import { ModalSize } from '../../../types/modal.type'
  import TextInput from '../TextInput.vue'
  import PrimaryButton from '../PrimaryButton.vue'
  import SecondaryButton from '../SecondaryButton.vue'
  import DetectedPhpList from '../DetectedPhpList.vue'
  import events from '../../events'
  import router from '../../router'
  import { useSettingsStore } from '../../stores/settings'

  const settingsStore = useSettingsStore()

  const modal = ref<InstanceType<typeof Modal> | null>(null)
  const phpPath = ref('')
  const detecting = ref(false)
  const hasScanned = ref(false)
  const detectedPaths = ref<string[]>([])
  const validationError = ref('')
  const returnTabId = ref<number | null>(null)

  const trimmedPhpPath = computed(() => phpPath.value.trim())

  let pendingDetectReply: ((paths: string[]) => void) | null = null

  const clearDetectListener = () => {
    if (pendingDetectReply) {
      window.ipcRenderer.removeListener('settings.detect-php.reply', pendingDetectReply)
      pendingDetectReply = null
    }
  }

  const phpLocatedListener = (locatedPath: string) => {
    if (modal.value?.isModalOpen && typeof locatedPath === 'string' && locatedPath) {
      phpPath.value = locatedPath
    }
  }

  const phpRequiredListener = (event: Event) => {
    const detail = (event as CustomEvent<{ tabId?: number } | undefined>).detail
    if (typeof detail?.tabId === 'number') {
      returnTabId.value = detail.tabId
    } else if (!modal.value?.isModalOpen) {
      returnTabId.value = null
    }

    if (modal.value?.isModalOpen) {
      return
    }

    phpPath.value = settingsStore.settings.php ?? ''
    detectedPaths.value = []
    hasScanned.value = false
    validationError.value = ''
    detecting.value = false
    modal.value?.openModal()
  }

  const detectPhp = () => {
    if (detecting.value) {
      return
    }

    clearDetectListener()
    detecting.value = true
    hasScanned.value = false
    validationError.value = ''

    pendingDetectReply = (paths: string[]) => {
      pendingDetectReply = null
      detecting.value = false
      hasScanned.value = true
      detectedPaths.value = Array.isArray(paths) ? paths : []
      if (detectedPaths.value.length > 0 && !phpPath.value.trim()) {
        phpPath.value = detectedPaths.value[0]
      }
    }

    window.ipcRenderer.once('settings.detect-php.reply', pendingDetectReply)
    window.ipcRenderer.send('settings.detect-php')
  }

  const selectDetectedPhp = (path: string) => {
    phpPath.value = path
    validationError.value = ''
  }

  const savePhpPath = async () => {
    const nextPath = trimmedPhpPath.value
    if (!nextPath) {
      validationError.value = 'Please enter a PHP executable path or detect one.'
      return
    }

    validationError.value = ''
    settingsStore.settings.php = nextPath
    settingsStore.update()

    const tabId = returnTabId.value
    returnTabId.value = null
    clearDetectListener()
    detecting.value = false
    modal.value?.closeModal()

    if (tabId !== null && router.currentRoute.value.name === 'settings') {
      await router.replace({ name: 'code', params: { id: tabId } })
    }
  }

  const goToSettings = async () => {
    returnTabId.value = null
    clearDetectListener()
    detecting.value = false
    modal.value?.closeModal()

    if (router.currentRoute.value.name !== 'settings') {
      await router.push({ name: 'settings', query: { missingPhp: '1' } })
    }
    events.dispatchEvent(new CustomEvent('settings.focus-php'))
  }

  const cancel = () => {
    modal.value?.closeModal()
    onClosed()
  }

  const onClosed = () => {
    clearDetectListener()
    detecting.value = false
    returnTabId.value = null
  }

  onMounted(() => {
    events.addEventListener('settings.php-required', phpRequiredListener)
    window.ipcRenderer.on('settings.php-located', phpLocatedListener)
  })

  onBeforeUnmount(() => {
    events.removeEventListener('settings.php-required', phpRequiredListener)
    window.ipcRenderer.removeListener('settings.php-located', phpLocatedListener)
    clearDetectListener()
  })
</script>

<template>
  <Modal ref="modal" :size="ModalSize.LG" @closed="onClosed">
    <template #title>
      <div class="flex items-center gap-3">
        <div
          class="flex size-9 shrink-0 items-center justify-center rounded-lg border"
          :style="{
            backgroundColor: settingsStore.colors.backgroundLight,
            borderColor: settingsStore.colors.border,
          }"
        >
          <CommandLineIcon class="size-5 text-primary-500" />
        </div>
        <div>
          <div>PHP path is not set</div>
          <p class="text-xs font-normal opacity-60">Local PHP configuration required</p>
        </div>
      </div>
    </template>

    <div class="space-y-4">
      <div
        class="flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed"
      >
        <ExclamationTriangleIcon class="mt-0.5 size-4 shrink-0 text-amber-500" />
        <p class="opacity-90">
          TweakPHP needs the path to your local PHP executable to run and inspect local projects. Enter it below or scan
          common system locations.
        </p>
      </div>

      <div class="space-y-1.5">
        <label for="php-path-modal-input" class="block text-xs font-medium opacity-80">PHP executable path</label>
        <div class="flex items-center gap-2">
          <TextInput
            id="php-path-modal-input"
            v-model="phpPath"
            placeholder="e.g. C:\php\php.exe or /usr/bin/php"
            aria-label="PHP executable path"
            class="flex-1 h-8 font-mono text-xs"
            autofocus
            @input="validationError = ''"
            @keydown.enter.prevent="savePhpPath"
          />
          <SecondaryButton :disabled="detecting" class="whitespace-nowrap select-none" @click="detectPhp">
            <ArrowPathIcon class="mr-1.5 size-4" :class="{ 'animate-spin': detecting }" />
            {{ detecting ? 'Scanning...' : 'Detect PHP' }}
          </SecondaryButton>
        </div>
        <p v-if="validationError" role="alert" class="text-xs text-red-500">{{ validationError }}</p>
      </div>

      <DetectedPhpList
        v-if="detectedPaths.length > 0"
        :paths="detectedPaths"
        :selected-path="phpPath"
        @select="selectDetectedPhp"
      />

      <p v-else-if="hasScanned && !detecting" class="text-xs opacity-60">
        No PHP binaries found in common locations. Enter the path manually above or open Settings.
      </p>
    </div>

    <template #actions>
      <div class="flex items-center justify-between gap-2 pt-1">
        <SecondaryButton without-border class="!px-2 text-xs opacity-80 hover:opacity-100" @click="goToSettings">
          Open Settings
        </SecondaryButton>
        <div class="flex items-center gap-2">
          <SecondaryButton @click="cancel">Cancel</SecondaryButton>
          <PrimaryButton :disabled="!trimmedPhpPath" @click="savePhpPath">Save &amp; Continue</PrimaryButton>
        </div>
      </div>
    </template>
  </Modal>
</template>
