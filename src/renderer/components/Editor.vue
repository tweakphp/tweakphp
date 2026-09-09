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
  import { registerCompletion } from 'monacopilot'
  import ToastAlert from '@/components/ToastAlert.vue'

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
    withAiCompletion: {
      type: Boolean,
      default: false,
    },
  })

  const errorAiCompletion = ref<string | null>(null)
  const editorContainer = ref(null)

  const vimMode = ref<ReturnType<typeof initVimMode> | null>(null)

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
  let lspRetryInterval: ReturnType<typeof setInterval> | null = null
  let lspWebSocket: WebSocket | null = null
  let aiCompletionRegistration: ReturnType<typeof registerCompletion> | null = null
  let isUnmounted = false
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
            if (tabsStore.current) {
              window.historyApi.undo(tabsStore.current?.id)
            }
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
            if (tabsStore.current) {
              window.historyApi.redo(tabsStore.current?.id)
            }
          },
        })

        editor.onDidChangeModelContent(() => {
          if (isUpdatingFromHistory.value) return

          const currentValue = editor!.getValue()
          emit('update:value', currentValue)

          const currentPosition = editor!.getPosition()
          if (currentPosition) {
            if (tabsStore.current) {
              saveHistoryNow(tabsStore.current?.id, currentValue, currentPosition)
            }
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

        if (tabsStore.current) {
          saveHistoryNow(tabsStore.current?.id, props.value, { lineNumber: 1, column: 1 })
        }
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
      } else if (editorModel.getValue() !== props.value) {
        editorModel.setValue(props.value)
      }

      editor.setModel(editorModel)

      if (props.withAiCompletion && settingsStore.settings.aiStatus) {
        aiCompletionRegistration = registerCompletion(monaco, editor, {
          language: 'php',
          trigger: 'onIdle',
          enableCaching: false,
          requestHandler: async ({ body }) => {
            const result = await window.ipcRenderer.invoke('ai:get-completion', {
              context: body,
              tab: JSON.parse(JSON.stringify(tabsStore.current)),
            })
            if (result?.error) {
              return { completion: null, error: result.error }
            }
            return result.data
          },
          onError: error => {
            errorAiCompletion.value = error.message
          },
        })
      }

      editor.onDidChangeModelContent(() => {
        if (editor) {
          emit('update:value', editor.getValue())
        }
      })

      if (props.autoFocus) {
        focusEditor()
      }

      if (window.platformInfo.getPlatform() !== 'win32' && !props.readonly && props.path && props.language === 'php') {
        startLspRetryInterval()
      }
    }
  })

  onBeforeUnmount(async () => {
    isUnmounted = true
    stopLspRetryInterval()

    if (lspWebSocket) {
      try {
        lspWebSocket.close()
      } catch {}
      lspWebSocket = null
    }

    if (props.language === 'php' && !props.readonly) {
      lspStore.setDisconnected()
    }

    if (props.enableHistory) {
      window.historyApi.removeAllListeners()
    }

    if (aiCompletionRegistration) {
      aiCompletionRegistration.deregister()
      aiCompletionRegistration = null
    }

    if (editor) {
      if (vimMode.value) {
        vimMode.value.dispose()
      }

      editor.dispose()
    }

    await disposeLanguageClient()
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

  const stopLspRetryInterval = () => {
    if (lspRetryInterval) {
      clearInterval(lspRetryInterval)
      lspRetryInterval = null
    }
  }

  const startLspRetryInterval = () => {
    if (lspRetryInterval || isUnmounted) return
    const lspUrl = `ws://127.0.0.1:${window.platformInfo.getLspPort()}`
    lspRetryInterval = setInterval(async () => {
      try {
        await createWebSocketClient(lspUrl)
        stopLspRetryInterval()
      } catch (error) {
        console.error('WebSocket connection failed, retrying...', error)
      }
    }, 1000)
  }

  const disposeLanguageClient = async () => {
    const client = languageClient
    languageClient = null
    if (!client) return
    try {
      if (client.isRunning()) {
        await client.stop()
      }
    } catch {}
    try {
      await client.dispose()
    } catch {}
  }

  const reconnectLsp = async () => {
    stopLspRetryInterval()
    await disposeLanguageClient()
    try {
      await createWebSocketClient(`ws://127.0.0.1:${window.platformInfo.getLspPort()}`)
    } catch {
      startLspRetryInterval()
    }
  }

  const createWebSocketClient = (url: string) => {
    return new Promise<void>((resolve, reject) => {
      if (lspWebSocket) {
        const stale = lspWebSocket
        lspWebSocket = null
        try {
          stale.close()
        } catch {}
      }

      lspStore.setConnecting()
      const webSocket = new WebSocket(url)
      lspWebSocket = webSocket

      webSocket.onopen = async () => {
        if (isUnmounted || lspWebSocket !== webSocket) {
          try {
            webSocket.close()
          } catch {}
          reject(new Error('LSP connection superseded'))
          return
        }

        const socket = toSocket(webSocket)
        const messageTransports = {
          reader: new WebSocketMessageReader(socket),
          writer: new WebSocketMessageWriter(socket),
        }
        const client = createLanguageClient(messageTransports)
        languageClient = client

        messageTransports.reader.onClose(async () => {
          if (languageClient === client) {
            languageClient = null
          }
          try {
            if (client.isRunning()) await client.stop()
          } catch {}
          try {
            await client.dispose()
          } catch {}
        })

        try {
          await client.start()
          lspStore.setConnected()
          resolve()
        } catch (e) {
          lspStore.setDisconnected()
          reject(e instanceof Error ? e : new Error(String(e)))
        }
      }

      // webSocket.onmessage = message => {
      //   console.log(message)
      // }

      webSocket.onerror = error => {
        lspStore.setDisconnected()
        reject(error)
      }

      webSocket.onclose = () => {
        if (lspWebSocket === webSocket) lspWebSocket = null
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

  const getSelectedText = (): string => {
    if (!editor) return ''
    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!selection || !model || selection.isEmpty()) return ''
    return model.getValueInRange(selection)
  }

  defineExpose({
    updateValue,
    focusEditor,
    reconnectLsp,
    getSelectedText,
  })
</script>

<template>
  <div ref="editorContainer" class="w-full h-full">
    <ToastAlert
      :key="new Date().getTime()"
      v-if="errorAiCompletion"
      title="AI Completions Error"
      :message="errorAiCompletion"
    />
  </div>
</template>
