<script setup lang="ts">
  import Title from '../../components/Title.vue'
  import Divider from '../../components/Divider.vue'
  import { useSettingsStore } from '../../stores/settings'
  import SelectInput from '../../components/SelectInput.vue'
  import TextInput from '../../components/TextInput.vue'
  import { useOpenRouter } from '../../composables/useOpenrouter'
  import { ref, onMounted, computed } from 'vue'
  import SwitchInput from '@/components/SwitchInput.vue'
  import TextareaInput from '@/components/TextareaInput.vue'
  import {
    DEFAULT_PROMPT_COMPLETE_CODE,
    DEFAULT_PROMPT_COMPLETE_COMMENT,
    DEFAULT_PROMPT_GENERATE_CODE_FROM_COMMENT,
  } from '../../../types/ai/prompts.ts'
  import PrimaryButton from '@/components/PrimaryButton.vue'
  import ArrowPathIcon from '@/components/icons/ArrowPathIcon.vue'
  import ToastAlert from '@/components/ToastAlert.vue'
  import FormField from '@/components/forms/FormField.vue'

  const saved = ref(false)
  const showToast = ref(false)
  const settingsStore = useSettingsStore()

  const aiProvider = computed({
    get: () => settingsStore.settings.aiProvider ?? '',
    set: (value: string) => {
      settingsStore.settings.aiProvider = value || null
    },
  })

  const aiModelId = computed({
    get: () => settingsStore.settings.aiModelId ?? '',
    set: (value: string) => {
      settingsStore.settings.aiModelId = value || null
    },
  })

  const aiApiKey = computed({
    get: () => settingsStore.settings.aiApiKey ?? '',
    set: (value: string) => {
      settingsStore.settings.aiApiKey = value || null
    },
  })

  const { models, loading, error, fetchModels } = useOpenRouter()

  const copilotStatus = ref<{ signedIn: boolean }>({ signedIn: false })
  const copilotSigningIn = ref(false)
  const copilotUserCode = ref<string | null>(null)
  const copilotVerificationUri = ref<string | null>(null)
  const copilotError = ref<string | null>(null)

  const isCopilotProvider = computed(() => settingsStore.settings.aiProvider === 'copilot')

  const refreshCopilotStatus = async () => {
    if (window.copilotApi) {
      copilotStatus.value = await window.copilotApi.status()
    }
  }

  const copilotSignIn = async () => {
    if (!window.copilotApi) return
    copilotSigningIn.value = true
    copilotError.value = null
    copilotUserCode.value = null
    const result = await window.copilotApi.signIn()
    copilotSigningIn.value = false
    if (result.success) {
      copilotUserCode.value = null
      await refreshCopilotStatus()
    } else {
      copilotError.value = result.error
    }
  }

  const copilotSignOut = async () => {
    if (!window.copilotApi) return
    await window.copilotApi.signOut()
    await refreshCopilotStatus()
  }

  onMounted(() => {
    if (settingsStore.settings.aiProvider === 'openrouter') {
      fetchModels()
    }

    if (settingsStore.settings.aiProvider === 'copilot') {
      refreshCopilotStatus()
    }

    window.copilotApi?.onSignInCode(data => {
      copilotUserCode.value = data.userCode
      copilotVerificationUri.value = data.verificationUri
    })

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

    if (settingsStore.settings.aiProvider === 'copilot') {
      copilotError.value = null
      refreshCopilotStatus()
    }

    saveSettings()
  }

  const saveSettings = () => {
    saved.value = true
    showToast.value = true
    settingsStore.update()
    setTimeout(() => {
      saved.value = false
      showToast.value = false
    }, 2000)
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
    <p class="mt-2 text-xs opacity-70">Configure the AI provider, model, API key, and prompt templates.</p>
    <Divider class="mt-3" />

    <FormField
      class="mt-3"
      label="Active"
      align="start"
      description="Enable AI-powered code completion and generation in the editor."
      divider
    >
      <SwitchInput id="ai-status" v-model="settingsStore.settings.aiStatus" @update:model-value="saveSettings()">
      </SwitchInput>
    </FormField>

    <FormField
      class="mt-3"
      label="Provider"
      align="start"
      description="The AI service used for completion and code generation requests."
    >
      <SelectInput
        id="ai-provider"
        v-model="aiProvider"
        @change="onProviderChange()"
        placeholder="Select the AI provider"
      >
        <option value="openrouter">OpenRouter</option>
        <option value="copilot">GitHub Copilot</option>
      </SelectInput>
    </FormField>
    <template v-if="settingsStore.settings.aiProvider === 'openrouter'">
      <Divider class="mt-3" />
      <FormField class="mt-3" label="Models" align="start" description="The model that handles AI completion requests.">
        <div>
          <SelectInput
            id="ai-model"
            v-model="aiModelId"
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
      </FormField>
      <p class="text-xs opacity-70 mt-3">
        GPT-4o-mini is recommended. Larger models offer better performance but require more time for responses, making
        autocompletion less immediate and useful.
      </p>
    </template>
    <template v-if="isCopilotProvider">
      <Divider class="mt-3" />
      <FormField class="mt-3" label="Status">
        <div class="text-sm">
          <span v-if="copilotStatus.signedIn" class="text-green-500">Signed in</span>
          <span v-else class="opacity-70">Not signed in</span>
        </div>
      </FormField>
      <div v-if="!copilotStatus.signedIn" class="mt-3">
        <p class="text-xs opacity-70">
          Sign in with your GitHub account. An active GitHub Copilot subscription is required.
        </p>
        <div v-if="copilotSigningIn && copilotUserCode" class="mt-3 border rounded-md p-4 text-center">
          <p class="text-xs opacity-70">Waiting for authorization. Enter this code on GitHub:</p>
          <p class="mt-2 text-2xl font-mono font-bold tracking-widest select-all">{{ copilotUserCode }}</p>
          <p class="mt-2 text-xs opacity-70">
            The browser opened {{ copilotVerificationUri }}. If it did not, open it manually and enter the code.
          </p>
        </div>
        <div class="flex items-center gap-3 py-3">
          <PrimaryButton @click="copilotSignIn()" :disabled="copilotSigningIn">
            <ArrowPathIcon v-if="copilotSigningIn" :spin="true" class="w-4 h-4 animate-spin mr-1" />
            {{ copilotSigningIn ? 'Waiting for GitHub...' : 'Sign in with GitHub' }}
          </PrimaryButton>
        </div>
        <p v-if="copilotError" class="text-xs text-red-500 mt-1">{{ copilotError }}</p>
      </div>
      <div v-else class="flex items-center gap-3 py-3">
        <PrimaryButton @click="copilotSignOut()">Sign out</PrimaryButton>
      </div>
    </template>
    <template v-if="!isCopilotProvider">
      <Divider class="mt-3" />
      <FormField
        class="mt-3"
        label="API Key"
        align="start"
        description="Authentication key issued by the selected provider."
        divider
      >
        <TextInput
          id="api-key"
          type="password"
          class="w-full"
          v-model="aiApiKey"
          @change="saveSettings()"
          placeholder="Insert your API key here"
        />
      </FormField>

      <p class="text-xs opacity-70 mt-3">
        Your API key is stored locally and only used to send requests to the selected provider.
      </p>
    </template>

    <template v-if="!isCopilotProvider">
      <Title class="mt-12">Customization prompt</Title>
      <Divider class="mt-3" />

      <div class="mt-3 grid grid-cols-1 items-start">
        <div class="pt-2">Generate code from comment prompt template</div>
        <p class="text-xs opacity-70 my-3">
          This template is used when requesting the model to generate code starting from a comment. You can use it to
          have the model create functions or classes based on specifications described in comments.
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
    </template>
  </div>
</template>
