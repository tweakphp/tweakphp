<script lang="ts">
  import type * as Monaco from 'monaco-editor'

  // Models created here can be shared by multiple editor instances with the
  // same URI. Dispose them only after the last instance releases them.
  const managedModels = new Map<Monaco.editor.ITextModel, number>()
</script>

<script setup lang="ts">
  import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
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
  import events from '../events'
  import { normalizedSnippetLength } from '../utils/snippet-insertion'

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
  let clientStarting = false
  let editor: monaco.editor.IStandaloneCodeEditor | null = null
  let editorModel: monaco.editor.ITextModel | null = null
  let connectionInterval: ReturnType<typeof setInterval> | null = null
  let connectionPending = false
  let disposed = false
  const sockets = new Set<WebSocket>()
  const emit = defineEmits(['update:value', 'cursor-change', 'ready'])

  // External value changes (e.g. code written by the MCP tools via the tabs
  // store reload): keep the Monaco editor in sync with props.value.
  // The identity check prevents feedback loops with our own update:value
  // emissions (user typing round-trips through the parent with equal value),
  // and the flag keeps the programmatic setValue from re-emitting.
  watch(
    () => props.value,
    value => {
      if (!editor || value === undefined || value === null) return
      if (editor.getValue() === value) return

      const position = editor.getPosition()
      isUpdatingFromHistory.value = true
      editor.setValue(value)
      if (position) {
        editor.setPosition(position)
      }
      isUpdatingFromHistory.value = false
    }
  )

  watch(
    () => props.readonly,
    readonly => editor?.updateOptions({ readOnly: readonly }),
    { flush: 'sync' }
  )

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
        model: null,
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
        // Default word separators minus `$`, so double-clicking a PHP
        // variable selects it including the dollar sign
        wordSeparators: '`~!@#%^&*()-=+[{]}\\|;:\'",.<>/?',
      })

      if (!props.readonly) {
        editor.addAction({
          id: 'save-snippet',
          label: 'Save Snippet',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS],
          contextMenuGroupId: '9_snippets',
          contextMenuOrder: 1,
          run: ed => {
            const selection = ed.getSelection()
            const model = ed.getModel()
            if (!model) {
              return
            }
            const code = selection && !selection.isEmpty() ? model.getValueInRange(selection) : ed.getValue()
            if (!code.trim()) {
              return
            }
            events.dispatchEvent(new CustomEvent('snippet.save.request', { detail: { code } }))
          },
        })
      }

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

      // Vim mode is pointless on a read-only preview (archive)
      if (settingsStore.settings.vimMode === 'on' && !props.readonly) {
        vimMode.value = initVimMode(editor)
      }

      const file = `${props.path}/${props.editorId}.${props.language}`

      editorModel = monaco.editor.getModel(monaco.Uri.file(file))
      if (!editorModel) {
        editorModel = monaco.editor.createModel(props.value, props.language, monaco.Uri.file(file))
        managedModels.set(editorModel, 0)
      }
      if (managedModels.has(editorModel)) managedModels.set(editorModel, managedModels.get(editorModel)! + 1)

      editor.setModel(editorModel)
      editor.onDidChangeCursorPosition(event => emit('cursor-change', event.position))

      if (props.withAiCompletion && settingsStore.settings.aiStatus) {
        registerCompletion(monaco, editor, {
          language: 'php',
          trigger: 'onIdle',
          enableCaching: false,
          requestHandler: async ({ body }) => {
            return await window.ipcRenderer.invoke('ai:get-completion', {
              context: body,
              tab: JSON.parse(JSON.stringify(tabsStore.current)),
            })
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
      emit('cursor-change', editor.getPosition())
      emit('ready')

      if (window.platformInfo.getPlatform() !== 'win32' && !props.readonly && props.path && props.language === 'php') {
        connectionInterval = setInterval(async () => {
          if (connectionPending || disposed) return
          connectionPending = true
          try {
            await createWebSocketClient(`ws://127.0.0.1:${window.platformInfo.getLspPort()}`)
            if (connectionInterval) clearInterval(connectionInterval)
            connectionInterval = null
          } catch (error) {
            if (!disposed) console.error('WebSocket connection failed, retrying...', error)
          } finally {
            connectionPending = false
          }
        }, 1000)
      }
    }
  })

  onBeforeUnmount(async () => {
    disposed = true
    if (connectionInterval) clearInterval(connectionInterval)
    for (const socket of sockets) socket.close()
    if (props.language === 'php' && !props.readonly && props.path && window.platformInfo.getPlatform() !== 'win32') {
      lspStore.setDisconnected()
    }

    if (props.enableHistory) {
      window.historyApi.removeAllListeners()
    }

    if (editor) {
      if (vimMode.value) {
        vimMode.value.dispose()
      }

      editor.dispose()
    }
    if (editorModel && managedModels.has(editorModel)) {
      const remaining = managedModels.get(editorModel)! - 1
      if (remaining === 0) {
        managedModels.delete(editorModel)
        editorModel.dispose()
      } else {
        managedModels.set(editorModel, remaining)
      }
    }
    if (languageClient && !clientStarting) {
      if (languageClient.isRunning()) await languageClient.stop()
      await languageClient.dispose()
    }
  })

  const updateValue = (value: any) => {
    if (editor) {
      editor.setValue(value)
    }
  }

  const focusEditor = (moveToEnd = true) => {
    if (editor) {
      const model = editor.getModel()
      if (model && moveToEnd) {
        const lineCount = model.getLineCount()
        const lastLine = model.getLineContent(lineCount)
        const lastColumn = lastLine.length + 1 // Column is 1-based index

        editor.setPosition({
          lineNumber: lineCount,
          column: lastColumn,
        })
      }
      editor.focus()
    }
  }

  const reconnectLsp = async () => {
    if (languageClient && languageClient.isRunning()) {
      await languageClient.stop()
      await languageClient.dispose()
    }

    await createWebSocketClient(`ws://127.0.0.1:${window.platformInfo.getLspPort()}`)
  }

  const createWebSocketClient = (url: string) => {
    return new Promise<void>((resolve, reject) => {
      lspStore.setConnecting()
      const webSocket = new WebSocket(url)
      sockets.add(webSocket)

      webSocket.onopen = async () => {
        if (disposed) {
          webSocket.close()
          reject(new Error('Editor disposed'))
          return
        }
        const socket = toSocket(webSocket)
        const messageTransports = {
          reader: new WebSocketMessageReader(socket),
          writer: new WebSocketMessageWriter(socket),
        }
        languageClient = createLanguageClient(messageTransports)

        messageTransports.reader.onClose(async () => {
          if (languageClient && languageClient.isRunning()) {
            await languageClient.stop()
          }
        })

        try {
          clientStarting = true
          await languageClient.start()
          clientStarting = false
          if (disposed) {
            await languageClient.stop()
            await languageClient.dispose()
          } else {
            lspStore.setConnected()
          }
        } catch (e) {
          clientStarting = false
          if (disposed) await languageClient.dispose()
          if (!disposed) lspStore.setDisconnected()
          // reject(error)
        }

        resolve()
      }

      // webSocket.onmessage = message => {
      //   console.log(message)
      // }

      webSocket.onerror = error => {
        if (!disposed) lspStore.setDisconnected()
        reject(error)
      }

      webSocket.onclose = () => {
        sockets.delete(webSocket)
        if (!disposed) lspStore.setDisconnected()
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

  const getPosition = (): monaco.IPosition | null => {
    return editor ? editor.getPosition() : null
  }

  const insertTextAtPosition = (text: string, position: monaco.IPosition | null) => {
    if (!editor) return
    const model = editor.getModel()
    if (!model) return

    let pos = position
    if (!pos || pos.lineNumber > model.getLineCount()) {
      const lineCount = model.getLineCount()
      pos = { lineNumber: lineCount, column: model.getLineContent(lineCount).length + 1 }
    } else {
      const lineLength = model.getLineContent(pos.lineNumber).length
      pos = { lineNumber: pos.lineNumber, column: Math.min(pos.column, lineLength + 1) }
    }

    const offset = model.getOffsetAt(pos)
    editor.pushUndoStop()
    editor.executeEdits('snippet', [
      {
        range: new monaco.Range(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
        text,
        forceMoveMarkers: true,
      },
    ])
    editor.setPosition(model.getPositionAt(offset + normalizedSnippetLength(text, model.getEOL())))
    editor.pushUndoStop()
    editor.focus()
  }

  defineExpose({
    updateValue,
    focusEditor,
    reconnectLsp,
    getSelectedText,
    getPosition,
    isReady: () => Boolean(editor?.getModel()),
    insertTextAtPosition,
  })
</script>

<template>
  <div ref="editorContainer" class="relative w-full h-full">
    <ToastAlert
      :key="new Date().getTime()"
      v-if="errorAiCompletion"
      title="AI Completions Error"
      :message="errorAiCompletion"
    />
  </div>
</template>
