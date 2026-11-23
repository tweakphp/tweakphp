// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Toolbar from './Toolbar.vue'
import { Tab } from '../../types/tab.type'

const state = reactive<{
  tab: Tab | null
  connections: any[]
}>({
  tab: null,
  connections: [],
})

const updateTab = vi.fn()

vi.mock('./Editor.vue', () => ({ default: defineComponent({ render: () => h('div') }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('../stores/tabs', () => ({
  useTabsStore: () => ({
    get current() {
      return state.tab
    },
    getCurrent: () => state.tab,
    getConnectionConfig: vi.fn(),
    updateTab,
  }),
  isRemoteOnly: (tab: Tab | null | undefined) => !!tab && !tab.path,
}))
vi.mock('../stores/settings', () => ({
  useSettingsStore: () => ({ settings: { laravelPath: '/default/laravel' }, colors: {} }),
}))
vi.mock('../stores/ssh', () => ({ useSSHStore: () => ({ connections: [], updateConnection: vi.fn() }) }))
vi.mock('../stores/kubectl', () => ({ useKubectlStore: () => ({ connections: [], updateConnection: vi.fn() }) }))
vi.mock('../stores/docker', () => ({ useDockerStore: () => ({ connections: [], upsertConnection: vi.fn() }) }))
vi.mock('../stores/loaders', () => ({ useLoadersStore: () => ({ loaders: { custom: { name: 'CustomLoader' } } }) }))
vi.mock('../stores/vapor', () => ({
  useVaporStore: () => ({ getConnectionConfig: () => null, removeEnvironment: vi.fn(), setEnvironment: vi.fn() }),
}))
vi.mock('../stores/connections', () => ({
  useConnectionsStore: () => ({
    getConnection: (id: string) => state.connections.find(c => String(c.id) === String(id)),
  }),
}))

const makeTab = (overrides: Partial<Tab>): Tab => ({
  id: 1,
  name: 'project',
  type: 'code',
  code: '',
  path: undefined,
  execution: 'local',
  connection_id: null,
  loader: '',
  result: [],
  pane: { code: 50, result: 50 },
  info: { name: '', php_version: '', version: '' },
  ...overrides,
})

const stubModal = () =>
  defineComponent({
    setup: (_props, { expose }) => {
      expose({ openModal: vi.fn() })
      return () => null
    },
  })

const DropDownStub = defineComponent({
  setup:
    (_props, { slots }) =>
    () =>
      h('div', { class: 'dropdown-stub' }, [slots.trigger?.(), slots.default?.()]),
})

const mountToolbar = () =>
  mount(Toolbar, {
    global: {
      directives: { tippy: () => {} },
      stubs: {
        DropDown: DropDownStub,
        DropDownItem: defineComponent({
          setup:
            (_props, { slots }) =>
            () =>
              h('button', { type: 'button' }, slots.default?.()),
        }),
        DockerConnectModal: stubModal(),
        SSHConnectionsModal: stubModal(),
        KubectlConnectionsModal: stubModal(),
        SnippetsModal: stubModal(),
      },
    },
  })

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.connections = []
  })

  it('shows snippets, editable loader, and read-only connection name + type for remote-only tabs', () => {
    state.tab = makeTab({
      id: 1,
      name: 'tweakphp-docker-app',
      execution: 'docker',
      connection_id: '10',
    })
    state.connections = [{ id: 10, type: 'docker', container_name: 'tweakphp-docker-app' }]

    const wrapper = mountToolbar()

    expect(wrapper.findAll('.dropdown-stub')).toHaveLength(1)
    const text = wrapper.text()
    expect(text).toContain('Snippets')
    expect(text).toContain('Loader')
    expect(text).toContain('tweakphp-docker-app')
    expect(text).toContain('Docker')
    expect(text).not.toContain('Local')
    expect(text).not.toContain('Vapor')
    expect(text).not.toContain('SSH')
    expect(text).not.toContain('Kubernetes')
  })

  it('keeps loader editable on remote-only tabs', async () => {
    const tab = makeTab({
      id: 2,
      name: 'Demo 123',
      execution: 'ssh',
      connection_id: '20',
    })
    state.tab = tab
    state.connections = [{ id: 20, type: 'ssh', name: 'Demo 123', color: 'red' }]

    const wrapper = mountToolbar()
    const loaderItem = wrapper.findAll('button').find(button => button.text().trim() === 'CustomLoader')
    expect(loaderItem).toBeDefined()
    await loaderItem!.trigger('click')
    expect(tab.loader).toBe('CustomLoader')
    expect(updateTab).toHaveBeenCalledWith(tab)
    expect(wrapper.text()).toContain('Demo 123')
    expect(wrapper.text()).toContain('SSH')
  })

  it('shows connection switchers for tabs with a local path', () => {
    state.tab = makeTab({
      id: 3,
      name: 'my-project',
      path: '/tmp/my-project',
      execution: 'local',
    })

    const wrapper = mountToolbar()
    const text = wrapper.text()
    expect(text).toContain('Local')
    expect(text).toContain('Docker')
    expect(text).toContain('Vapor')
    expect(text).toContain('SSH')
    expect(text).toContain('Kubernetes')
    expect(text).toContain('Loader')
    expect(wrapper.findAll('.dropdown-stub')).toHaveLength(5)
  })
})
