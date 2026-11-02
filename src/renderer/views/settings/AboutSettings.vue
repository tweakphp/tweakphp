<script setup lang="ts">
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import FormField from '../../components/forms/FormField.vue'
  import PrimaryButton from '../../components/PrimaryButton.vue'
  import HeartIcon from '../../components/icons/HeartIcon.vue'
  import { useSettingsStore } from '../../stores/settings'

  const settingsStore = useSettingsStore()

  const websiteUrl = 'https://tweakphp.com/'
  const repositoryUrl = 'https://github.com/tweakphp/tweakphp'
  const donationUrl = 'https://github.com/sponsors/ILDaviz'

  const openLink = (url: string) => {
    window.ipcRenderer.send('link.open', url)
  }
</script>

<template>
  <div>
    <div class="flex items-center justify-between">
      <Title>About</Title>
    </div>
    <Divider class="mt-3" />

    <FormField class="mt-3" label="Version" divider>
      <span>{{ settingsStore.settings.version }}</span>
    </FormField>

    <FormField class="mt-3" label="Website" divider>
      <a
        :href="websiteUrl"
        class="text-primary-500 hover:underline"
        rel="noreferrer"
        @click.prevent="openLink(websiteUrl)"
      >
        tweakphp.com
      </a>
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

    <div class="mt-3 rounded-xl border border-primary-500/20 bg-primary-500/5 p-6">
      <div class="flex items-start gap-5">
        <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-primary-500/10">
          <HeartIcon class="h-8 w-8 text-primary-400" />
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-bold">Support TweakPHP</h3>
          <p class="mt-1 text-sm opacity-70">
            Your contribution helps sustain development and keeps TweakPHP free and open source for everyone.
          </p>
          <div class="mt-4">
            <PrimaryButton @click="openLink(donationUrl)">
              <HeartIcon class="h-4 w-4" />
              <span class="ml-2">Donate Now</span>
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
