<script setup>
    import { onMounted, onBeforeUnmount, ref } from 'vue'
    import * as monaco from 'monaco-editor'
    import { useSettingsStore } from '@/stores/settings'
    import { MonacoLanguageClient } from 'monaco-languageclient'
    import { toSocket, WebSocketMessageReader, WebSocketMessageWriter } from 'vscode-ws-jsonrpc'
    import { CloseAction, ErrorAction } from 'vscode-languageclient'
    import { installPHPLanguage, installThemes } from '@/editor.js'

    const settingsStore = useSettingsStore()

    // Props
    const props = defineProps({
        editorId: {
            type: String,
        },
        language: {
            type: String,
            default: 'custom-php',
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

    let languageClient = null
    let editor = null
    const emit = defineEmits(['update:value'])

    if (props.language === 'php') {
        installPHPLanguage()
    }

    onMounted(async () => {
        installThemes()

        if (editorContainer.value) {
            editor = monaco.editor.create(editorContainer.value, {
                readOnly: props.readonly,
                fontSize: settingsStore.settings.editor.fontSize,
                minimap: {
                    enabled: false,
                },
                wordWrap: settingsStore.settings.editor.wordWrap,
                theme: settingsStore.settings.theme,
                stickyScroll: {
                    enabled: false,
                },
                automaticLayout: true,
                glyphMargin: false,
                scrollBeyondLastLine: false,
                lightbulb: { enabled: false },
            })

            const file = `${props.path}/${props.editorId}.${props.language}`

            let editorModel = await monaco.editor.getModel(monaco.Uri.file(file))
            if (!editorModel) {
                editorModel = await monaco.editor.createModel(props.value, props.language, monaco.Uri.file(file))
            }

            await editor.setModel(editorModel)

            editor.onDidChangeModelContent(() => {
                emit('update:value', editor.getValue())
            })

            if (props.autoFocus) {
                focusEditor()
            }

            if (!props.readonly && props.path && props.language === 'php') {
                await createWebSocketClient(`ws://127.0.0.1:${import.meta.env.VITE_LSP_WEBSOCKET_PORT}`)
            }
        }
    })

    onBeforeUnmount(async () => {
        if (editor) {
            await editor.dispose()
        }
        if (languageClient && languageClient.isRunning()) {
            await languageClient.stop()
            await languageClient.dispose()
        }
    })

    const updateValue = value => {
        if (editor) {
            editor.setValue(value)
        }
    }

    const focusEditor = () => {
        if (editor) {
            const model = editor.getModel()
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

    const createWebSocketClient = url => {
        return new Promise((resolve, reject) => {
            const webSocket = new WebSocket(url)

            webSocket.onopen = async () => {
                const socket = toSocket(webSocket)
                const messageTransports = {
                    reader: new WebSocketMessageReader(socket),
                    writer: new WebSocketMessageWriter(socket),
                }
                languageClient = createLanguageClient(messageTransports)

                messageTransports.reader.onClose(async () => {
                    await languageClient.stop()
                })

                try {
                    await languageClient.start()
                } catch (e) {
                    // reject(error)
                }

                resolve()
            }

            webSocket.onmessage = message => {
                console.log(message)
            }

            webSocket.onerror = error => {
                reject(error)
            }
        })
    }

    const createLanguageClient = messageTransports => {
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
