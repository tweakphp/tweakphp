import './assets/main.css'
import './assets/sf-dump.css'
import './assets/sf-dump.js'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router/index'
import { useWorkerFactory } from 'monaco-editor-wrapper/workerFactory'

import { plugin as VueTippy } from 'vue-tippy'
import { runLocalStorageMigration } from './utils/migration'
import { useTabsStore } from './stores/tabs'
import { useSSHStore } from './stores/ssh'
import { useKubectlStore } from './stores/kubectl'
import { useVaporStore } from './stores/vapor'
import { useLoadersStore } from './stores/loaders'
import { useHistoryStore } from './stores/history'
import { useColorSchemeStore } from './stores/color-scheme'
import { useUpdateStore } from './stores/update'

useWorkerFactory({
  ignoreMapping: true,
  workerLoaders: {
    editorWorkerService: () =>
      new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), { type: 'module' }),
  },
})

const bootstrap = async () => {
  await runLocalStorageMigration()

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  app.use(router)
  app.use(VueTippy)

  const tabsStore = useTabsStore(pinia)
  const sshStore = useSSHStore(pinia)
  const kubectlStore = useKubectlStore(pinia)
  const vaporStore = useVaporStore(pinia)
  const loadersStore = useLoadersStore(pinia)
  const historyStore = useHistoryStore(pinia)
  const colorSchemeStore = useColorSchemeStore(pinia)
  const updateStore = useUpdateStore(pinia)

  app.mount('#app')

  await Promise.all([
    tabsStore.ready,
    sshStore.ready,
    kubectlStore.ready,
    vaporStore.ready,
    loadersStore.ready,
    historyStore.ready,
    colorSchemeStore.ready,
    updateStore.ready,
  ])
}

void bootstrap()
