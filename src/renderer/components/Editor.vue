<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref } from 'vue'
  import * as monaco from 'monaco-editor'
  import { MonacoLanguageClient } from 'monaco-languageclient'
  import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc'
  import { CloseAction, ErrorAction } from 'vscode-languageclient'
  import { initVimMode } from 'monaco-vim'
  import { installOutputLanguage, installPHPLanguage, installThemes } from '../editor'
  import { useSettingsStore } from '../stores/settings'
  import { useLspStore } from '../stores/lsp'
  import { useTabsStore } from '../stores/tabs'

  const settingsStore = useSettingsStore()
  const lspStore = useLspStore()
  const tabsStore = useTabsStore()

  // Props
  const props = defineProps({
    enableHistory: {
      type: Boolean,
      default: false,
    },
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
  const vimMode = ref(null)

  const isUpdatingFromHistory = ref(false)

  function saveHistoryNow(tabId: number, code: string, cursor: monaco.IPosition) {
    if (!window.historyApi) {
      console.warn('History API is not available')
      return
    }
    window.historyApi.add(tabId, code, cursor)
  }

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

      if (props.enableHistory) {
        editor.addAction({
          id: 'history-undo',
          label: 'History: Undo',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyZ],
          run: () => {
            window.historyApi.undo(tabsStore.current?.id)
          },
        })

        editor.addAction({
          id: 'history-redo',
          label: 'History: Redo',
          keybindings: [
            monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyY,
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyZ,
          ],
          run: () => {
            window.historyApi.redo(tabsStore.current?.id)
          },
        })

        editor.onDidChangeModelContent(() => {
          if (isUpdatingFromHistory.value) return

          const currentValue = editor!.getValue()
          emit('update:value', currentValue)

          const currentPosition = editor!.getPosition()
          if (currentPosition) {
            saveHistoryNow(tabsStore.current?.id, currentValue, currentPosition)
          }
        })

        window.historyApi.onUndoReply(data => {
          if (editor) {
            isUpdatingFromHistory.value = true
            editor.setValue(data.code)

            if (data.cursor) {
              editor.setPosition(data.cursor)
            }
            editor.focus()
            isUpdatingFromHistory.value = false
          }
        })

        window.historyApi.onRedoReply(data => {
          if (editor) {
            isUpdatingFromHistory.value = true
            editor.setValue(data.code)

            if (data.cursor) {
              editor.setPosition(data.cursor)
            }
            editor.focus()
            isUpdatingFromHistory.value = false
          }
        })

        saveHistoryNow(tabsStore.current?.id, props.value, { lineNumber: 1, column: 1 })
      } else {
        editor.onDidChangeModelContent(() => {
          emit('update:value', editor!.getValue())
        })
      }

      if (settingsStore.settings.vimMode === 'on') {
        vimMode.value = initVimMode(editor)
      }

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
    lspStore.setDisconnected()

    if (props.enableHistory) {
      window.historyApi.removeAllListeners()
    }

    if (editor) {
      if (vimMode.value) {
        vimMode.value.dispose()
      }

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

  const reconnectLsp = async () => {
    if (languageClient && languageClient.isRunning()) {
      await languageClient.stop()
      await languageClient.dispose()
    }

    await createWebSocketClient(`ws://127.0.0.1:${import.meta.env.VITE_LSP_WEBSOCKET_PORT}`)
  }

  const createWebSocketClient = (url: string) => {
    return new Promise<void>((resolve, reject) => {
      lspStore.setConnecting()
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
          lspStore.setConnected()
        } catch (e) {
          lspStore.setDisconnected()
          // reject(error)
        }

        resolve()
      }

      // webSocket.onmessage = message => {
      //   console.log(message)
      // }

      webSocket.onerror = error => {
        lspStore.setDisconnected()
        reject(error)
      }

      webSocket.onclose = () => {
        lspStore.setDisconnected()
      }
    })
  }

  const createLanguageClient = (messageTransports: {
    reader: WebSocketMessageReader
    writer: WebSocketMessageWriter
  }) => {
    const workspacePath = `${props.path}`

    return new MonacoLanguageClient({
      id: props.editorId,
      name: 'PHP Language Client',
      clientOptions: {
        documentSelector: ['php'],
        workspaceFolder: {
          index: props.editorId,
          name: 'workspace-' + props.editorId,
          uri: monaco.Uri.file(workspacePath),
        },
        initializationOptions: {
          storagePath:
            (window.platformInfo.getPlatform() !== 'win32'
              ? '/tmp/tweakphp-intelephense-'
              : 'C:/Temp/tweakphp-intelephense-') + encodeURIComponent(workspacePath || ''),
          licenceKey: settingsStore.settings.intelephenseLicenseKey || undefined,
          environment: workspacePath,
          clearCache: true,
          files: {
            maxSize: 100_000_000,
            exclude: [
              '**/.git/**',
              '**/CVS/**',
              '**/.DS_Store/**',
              '**/node_modules/**',
              '**/vendor/**/{Tests,tests}/**',
              '**/vendor/**/vendor/**',
            ],
          },
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
    reconnectLsp,
  })
</script>

<template>
  <div ref="editorContainer" class="w-full h-full"></div>
</template>
