<script setup lang="ts">
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import FormField from '../../components/forms/FormField.vue'
  import { useSettingsStore } from '../../stores/settings'

  const settingsStore = useSettingsStore()

  const repositoryUrl = 'https://github.com/tweakphp/tweakphp'
  const donationUrl = 'https://www.buymeacoffee.com/ildaviz'

  const openLink = (url: string) => {
    window.ipcRenderer.send('link.open', url)
  }
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <Title>About</Title>
    </div>
    <p class="mt-2 text-xs opacity-70">Application version, repository links, and ways to support TweakPHP.</p>
    <Divider class="mt-3" />

    <FormField class="mt-3" label="Version" divider>
      <span>{{ settingsStore.settings.version }}</span>
    </FormField>

    <FormField class="mt-3" label="GitHub repository" divider>
      <a
        :href="repositoryUrl"
        class="text-primary-500 hover:underline"
        rel="noreferrer"
        @click.prevent="openLink(repositoryUrl)"
      >
        tweakphp/tweakphp
      </a>
    </FormField>

    <FormField class="mt-3" label="Support TweakPHP">
      <a
        :href="donationUrl"
        class="text-primary-500 hover:underline"
        rel="noreferrer"
        @click.prevent="openLink(donationUrl)"
      >
        Make a donation
      </a>
    </FormField>
  </div>
</template>
