import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import { useWorkerFactory } from 'monaco-editor-wrapper/workerFactory'

useWorkerFactory({
    ignoreMapping: true,
    workerLoaders: {
        editorWorkerService: () =>
            new Worker(
                new URL(
                    'monaco-editor/esm/vs/editor/editor.worker.js',
                    import.meta.url
                ),
                { type: 'module' }
            ),
    },
})

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
