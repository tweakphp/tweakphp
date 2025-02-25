<script setup lang="ts">
  import TextInput from '../components/TextInput.vue'
  import { onMounted, Ref, ref } from 'vue'
  import PrimaryButton from '../components/PrimaryButton.vue'
  import ArrowPathIcon from '../components/icons/ArrowPathIcon.vue'
  import { useLodaersStore } from '../stores/loaders'
  import { Loader } from '../../types/loader.type'
  import Editor from './Editor.vue'
  import { useSettingsStore } from '../stores/settings'

  const loadersStore = useLodaersStore()
  const settingsStore = useSettingsStore()
  const emit = defineEmits(['saved'])
  const props = defineProps({
    edit: {
      type: String,
      required: false,
    },
  })

  const form: Ref<Loader> = ref({
    name: '',
    code: `<?php

namespace TweakPHP\\Client\\Loaders;

class MyCustomLoader extends BaseLoader
{
    /**
     * @param string $path is the root path of your project
     */
    public function __construct(string $path)
    {
        // your custom loader logic here
        // for example:
        // require $path.'/vendor/autoload.php';
    }

    public function name(): string
    {
        return 'Your app name';
    }

    public function version(): string
    {
        return 'Your app version';
    }
}`,
  })
  const saving = ref(false)
  const saved = ref(false)
  const editor = ref()
  const editorIsReady = ref(false)

  onMounted(() => {
    if (props.edit) {
      const loader = loadersStore.get(props.edit)
      if (loader) {
        form.value = { ...loader }
      }
    }
    setTimeout(() => {
      editorIsReady.value = true
      editor.value.updateValue(form.value.code)
    }, 100)
  })

  const save = () => {
    if (!form.value.name || !form.value.code) {
      alert('Please fill in all fields')
      return
    }
    saving.value = true
    loadersStore.update(form.value)
    emit('saved')
    saving.value = false
    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 2000)
  }
</script>

<template>
  <div class="mt-3 w-full mx-auto">
    <form class="mx-auto space-y-3">
      <TextInput id="name" v-model="form.name" placeholder="MyCustomLoader" class="w-full" />
      <Editor
        ref="editor"
        v-show="editorIsReady"
        v-model:value="form.code"
        class="w-full border rounded-md p-1"
        :style="{
          borderColor: settingsStore.colors.border,
          height: '500px',
        }"
        language="php"
      />
      <div class="flex items-center justify-end space-x-2">
        <span :class="{ 'opacity-0': !saved, 'opacity-65': saved }" class="transition-all duration-300">
          Changes Saved
        </span>
        <PrimaryButton @click="save" :disabled="saving">
          <ArrowPathIcon
            v-if="saving"
            :spin="true"
            class="w-4 h-4 cursor-pointer hover:text-primary-500 animate-spin mr-1"
          />
          Save
        </PrimaryButton>
      </div>
    </form>
  </div>
</template>
