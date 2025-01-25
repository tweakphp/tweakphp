import './assets/main.css'
import './assets/sf-dump.css'
import './assets/sf-dump.js'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router/index'
import { useWorkerFactory } from 'monaco-editor-wrapper/workerFactory'

import { plugin as VueTippy } from 'vue-tippy'

useWorkerFactory({
  ignoreMapping: true,
  workerLoaders: {
    editorWorkerService: () =>
      new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker.js', import.meta.url), { type: 'module' }),
  },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(VueTippy)

app.mount('#app')
