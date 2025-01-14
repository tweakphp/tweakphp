<script setup lang="ts">
  import { onMounted, onBeforeUnmount, ref } from 'vue'
  import * as monaco from 'monaco-editor'
  import { MonacoLanguageClient } from 'monaco-languageclient'
  import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc'
  import { CloseAction, ErrorAction } from 'vscode-languageclient'
  import { installPHPLanguage, installOutputLanguage, installThemes } from '../editor'
  import { useSettingsStore } from '../stores/settings'

  const settingsStore = useSettingsStore()

  // Props
  const props = defineProps({
    editorId: {
      type: String,
    },
    language: {
      type: String,
      default: 'php',
    },
    readonly: {
      type: Boolean,
      default: false,
    },
    value: {
      type: String,
      default: '',
    },
    wrap: {
      type: Boolean,
      default: false,
    },
    path: {
      type: String,
    },
    autoFocus: {
      type: Boolean,
      default: false,
    },
  })

  const editorContainer = ref(null)

  let languageClient: MonacoLanguageClient | null = null
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  const emit = defineEmits(['update:value'])

  if (props.language === 'php') {
    installPHPLanguage()
  }

  if (props.language === 'output') {
    installOutputLanguage()
  }

  onMounted(async () => {
    installThemes()

    if (editorContainer.value) {
      editor = monaco.editor.create(editorContainer.value, {
        readOnly: props.readonly,
        fontSize: settingsStore.settings.editorFontSize,
        minimap: {
          enabled: false,
        },
        wordWrap: settingsStore.settings.editorWordWrap as 'on' | 'off' | 'wordWrapColumn' | 'bounded',
        theme: settingsStore.settings.theme,
        stickyScroll: {
          enabled: false,
        },
        automaticLayout: true,
        glyphMargin: false,
        scrollBeyondLastLine: false,
        lightbulb: { enabled: 'off' as monaco.editor.ShowLightbulbIconMode },
      })

      const file = `${props.path}/${props.editorId}.${props.language}`

      let editorModel = monaco.editor.getModel(monaco.Uri.file(file))
      if (!editorModel) {
        editorModel = monaco.editor.createModel(props.value, props.language, monaco.Uri.file(file))
      }

      editor.setModel(editorModel)

      editor.onDidChangeModelContent(() => {
        if (editor) {
          emit('update:value', editor.getValue())
        }
      })

      if (props.autoFocus) {
        focusEditor()
      }

      if (window.platformInfo.getPlatform() !== 'win32' && !props.readonly && props.path && props.language === 'php') {
        const interval = setInterval(async () => {
          try {
            await createWebSocketClient(`ws://127.0.0.1:${import.meta.env.VITE_LSP_WEBSOCKET_PORT}`)
            clearInterval(interval)
          } catch (error) {
            console.error('WebSocket connection failed, retrying...', error)
          }
        }, 1000)
      }
    }
  })

  onBeforeUnmount(async () => {
    if (editor) {
      editor.dispose()
    }
    if (languageClient && languageClient.isRunning()) {
      if (languageClient) {
        await languageClient.stop()
      }
      await languageClient.dispose()
    }
  })

  const updateValue = (value: any) => {
    if (editor) {
      editor.setValue(value)
    }
  }

  const focusEditor = () => {
    if (editor) {
      const model = editor.getModel()
      if (model) {
        const lineCount = model.getLineCount()
        const lastLine = model.getLineContent(lineCount)
        const lastColumn = lastLine.length + 1 // Column is 1-based index

        editor.setPosition({
          lineNumber: lineCount,
          column: lastColumn,
        })

        editor.focus()
      }
    }
  }

  const createWebSocketClient = (url: string) => {
    return new Promise<void>((resolve, reject) => {
      const webSocket = new WebSocket(url)

      webSocket.onopen = async () => {
        const socket = toSocket(webSocket)
        const messageTransports = {
          reader: new WebSocketMessageReader(socket),
          writer: new WebSocketMessageWriter(socket),
        }
        languageClient = createLanguageClient(messageTransports)

        messageTransports.reader.onClose(async () => {
          if (languageClient) {
            await languageClient.stop()
          }
        })

        try {
          await languageClient.start()
        } catch (e) {
          // reject(error)
        }

        resolve()
      }

      // webSocket.onmessage = message => {
      //   console.log(message)
      // }

      webSocket.onerror = error => {
        reject(error)
      }
    })
  }

  const createLanguageClient = (messageTransports: {
    reader: WebSocketMessageReader
    writer: WebSocketMessageWriter
  }) => {
    return new MonacoLanguageClient({
      id: props.editorId,
      name: 'PHP Language Client',
      clientOptions: {
        documentSelector: ['php'],
        workspaceFolder: {
          index: props.editorId,
          name: 'workspace-' + props.editorId,
          uri: monaco.Uri.file(`${props.path}`),
        },
        errorHandler: {
          error: () => ({ action: ErrorAction.Continue }),
          closed: () => ({ action: CloseAction.DoNotRestart }),
        },
      },
      connectionProvider: {
        get: () => Promise.resolve(messageTransports),
      },
    })
  }

  defineExpose({
    updateValue,
    focusEditor,
  })
</script>

<template>
  <div ref="editorContainer" class="w-full h-full"></div>
</template>
