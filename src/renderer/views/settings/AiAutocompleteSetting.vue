<script setup lang="ts">
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import { useSettingsStore } from '../../stores/settings'
  import SelectInput from '../../components/SelectInput.vue'
  import TextInput from '../../components/TextInput.vue'
  import { useOpenRouter } from '../../composables/useOpenrouter'
  import { onMounted } from 'vue'
  import SwitchInput from '@/components/SwitchInput.vue'
  import TextareaInput from '@/components/TextareaInput.vue'
  import {
    DEFAULT_PROMPT_COMPLETE_CODE,
    DEFAULT_PROMPT_COMPLETE_COMMENT,
    DEFAULT_PROMPT_GENERATE_CODE_FROM_COMMENT,
  } from '../../../types/ai/prompts.ts'
  import PrimaryButton from '@/components/PrimaryButton.vue'
  import ToastAlert from '@/components/ToastAlert.vue'
  import { useSavedToast } from '../../composables/useSavedToast'

  const { showToast, markSaved } = useSavedToast()
  const settingsStore = useSettingsStore()

  const { models, loading, error, fetchModels } = useOpenRouter()

  onMounted(() => {
    if (settingsStore.settings.aiProvider === 'openrouter') {
      fetchModels()
    }

    if (!settingsStore.settings.aiPromptTemplateGenerateCodeFromComment) {
      settingsStore.settings.aiPromptTemplateGenerateCodeFromComment = DEFAULT_PROMPT_GENERATE_CODE_FROM_COMMENT
    }

    if (!settingsStore.settings.aiPromptTemplateCompleteComment) {
      settingsStore.settings.aiPromptTemplateCompleteComment = DEFAULT_PROMPT_COMPLETE_COMMENT
    }

    if (!settingsStore.settings.aiPromptTemplateCompleteCode) {
      settingsStore.settings.aiPromptTemplateCompleteCode = DEFAULT_PROMPT_COMPLETE_CODE
    }
  })

  const onProviderChange = () => {
    if (settingsStore.settings.aiProvider === 'openrouter') {
      fetchModels()
    }
    saveSettings()
  }

  const saveSettings = () => {
    settingsStore.update()
    markSaved()
  }

  function resetAiPromptTemplateCompleteComment() {
    settingsStore.settings.aiPromptTemplateCompleteComment = DEFAULT_PROMPT_COMPLETE_COMMENT
    saveSettings()
  }

  function resetAiPromptTemplateGenerateCodeFromComment() {
    settingsStore.settings.aiPromptTemplateGenerateCodeFromComment = DEFAULT_PROMPT_GENERATE_CODE_FROM_COMMENT
    saveSettings()
  }

  function resetAiPromptTemplateCompleteCode() {
    settingsStore.settings.aiPromptTemplateCompleteCode = DEFAULT_PROMPT_COMPLETE_CODE
    saveSettings()
  }
</script>

<template>
  <div>
    <ToastAlert v-if="showToast" title="Settings Saved" />
    <div class="flex items-center justify-between overscroll-y-contain">
      <Title>AI Completion</Title>
    </div>
    <Divider class="mt-3" />

    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Active</div>
      <SwitchInput id="ai-status" v-model="settingsStore.settings.aiStatus" @update:model-value="saveSettings()">
      </SwitchInput>
    </div>

    <Divider class="mt-3" />

    <div class="mt-3 grid grid-cols-2 items-center">
      <div>Provider</div>
      <SelectInput
        id="ai-provider"
        v-model="settingsStore.settings.aiProvider"
        @change="onProviderChange()"
        placeholder="Select the AI provider"
      >
        <option value="openrouter">OpenRouter</option>
      </SelectInput>
    </div>
    <template v-if="settingsStore.settings.aiProvider === 'openrouter'">
      <Divider class="mt-3" />
      <div class="mt-3 grid grid-cols-2 items-center">
        <div>Models</div>
        <div>
          <SelectInput
            id="ai-model"
            v-model="settingsStore.settings.aiModelId"
            @change="saveSettings()"
            placeholder="Select the AI Model"
            :disabled="loading || !!error"
          >
            <option v-if="loading" value="" disabled>Loading models...</option>
            <option v-for="model in models" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </SelectInput>
          <p v-if="error" class="text-xs text-red-500 mt-1">It is impossible to fetch models: {{ error }}</p>
        </div>
      </div>
      <p class="text-xs opacity-70 mt-3">
        GPT-4o-mini is recommended. Larger models offer better performance but require more time for responses, making
        autocompletion less immediate and useful.
      </p>
    </template>
    <Divider class="mt-3" />
    <div class="mt-3 grid grid-cols-2 items-center">
      <div>API Key</div>
      <TextInput
        id="api-key"
        type="password"
        v-model="settingsStore.settings.aiApiKey"
        @change="saveSettings()"
        placeholder="Insert your API key here"
      />
    </div>

    <Divider class="mt-3" />
    <p class="text-xs opacity-70 mt-3">
      Your API key is stored locally and only used to send requests to the selected provider.
    </p>

    <Title class="mt-12">Customization prompt</Title>
    <Divider class="mt-3" />

    <div class="mt-3 grid grid-cols-1 items-start">
      <div class="pt-2">Generate code from comment prompt template</div>
      <p class="text-xs opacity-70 my-3">
        This template is used when requesting the model to generate code starting from a comment. You can use it to have
        the model create functions or classes based on specifications described in comments.
      </p>
      <TextareaInput
        id="ai-prompt-template-generate-code-from-comment"
        v-model="settingsStore.settings.aiPromptTemplateGenerateCodeFromComment"
        :rows="8"
      />
      <div class="flex items-center gap-3 py-3">
        <PrimaryButton @click="saveSettings()">Save</PrimaryButton>
        <PrimaryButton @click="resetAiPromptTemplateGenerateCodeFromComment()">Reset</PrimaryButton>
      </div>
    </div>

    <Divider class="mt-3" />

    <div class="mt-3 grid grid-cols-1 items-start">
      <div class="pt-2">Complete comment prompt template</div>
      <p class="text-xs opacity-70 my-3">
        This template is used when requesting the model to complete an existing comment. You can use it to have the
        model suggest more detailed descriptions or additional explanations.
      </p>
      <TextareaInput
        id="ai-prompt-template-complete-comment"
        v-model="settingsStore.settings.aiPromptTemplateCompleteComment"
        :rows="8"
      />
      <div class="flex items-center gap-3 py-3">
        <PrimaryButton @click="saveSettings()">Save</PrimaryButton>
        <PrimaryButton @click="resetAiPromptTemplateCompleteComment()">Reset</PrimaryButton>
      </div>
    </div>

    <Divider class="mt-3" />

    <div class="mt-3 grid grid-cols-1 items-start">
      <div class="pt-2">Complete code prompt template</div>
      <p class="text-xs opacity-70 my-3">
        This template is used when requesting the model to complete an existing code block. You can use it to have the
        model suggest completions for functions or classes.
      </p>
      <TextareaInput
        id="ai-prompt-template-complete-code"
        v-model="settingsStore.settings.aiPromptTemplateCompleteCode"
        :rows="8"
      />
      <div class="flex items-center gap-3 py-3">
        <PrimaryButton @click="saveSettings()">Save</PrimaryButton>
        <PrimaryButton @click="resetAiPromptTemplateCompleteCode()">Reset</PrimaryButton>
      </div>
    </div>
  </div>
</template>
