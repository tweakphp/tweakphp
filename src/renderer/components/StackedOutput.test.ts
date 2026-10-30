// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Result } from '../../types/tab.type'
import StackedOutput from './StackedOutput.vue'

const { settings } = vi.hoisted(() => ({ settings: { outputMode: 'stacked', stackedDump: 'extended' } }))
vi.mock('../stores/settings', () => ({ useSettingsStore: () => ({ settings, colors: {} }) }))

describe('StackedOutput', () => {
  afterEach(() => {
    settings.outputMode = 'stacked'
    document.body.replaceChildren()
  })

  it('shows printed JSON and a separate return dump in full stack', async () => {
    settings.outputMode = 'full'
    const result: Result = {
      line: 8,
      code: 'print $user;',
      output: '{"id":1}1',
      html: '<pre>1</pre>',
      explicitOutput: '{"id":1}',
      explicitHtml: '',
      parts: [
        { output: '{"id":1}', html: '', implicit: false },
        { output: '1', html: '<pre class="sf-dump" id="return-dump">1</pre>', implicit: true },
      ],
      htmlReady: true,
    }
    window.Sfdump = vi.fn()
    const wrapper = mount(StackedOutput, { props: { output: [result] }, attachTo: document.body })
    await flushPromises()

    expect(wrapper.get('#dump-8').text()).toContain('{"id":1}')
    expect(wrapper.get('#dump-8').text()).toContain('Return value')
    expect(wrapper.get('#return-dump').text()).toBe('1')
    expect(window.Sfdump).toHaveBeenCalledWith('return-dump')
    wrapper.unmount()
  })

  it('renders every Symfony dump and initializes each one', async () => {
    const result: Result = {
      line: 1,
      code: 'dump($user);',
      output: 'user1user2',
      html: '<pre>user1</pre><pre>user2</pre>',
      explicitOutput: 'user1user2',
      explicitHtml: '<pre>user1</pre><pre>user2</pre>',
      parts: [
        { output: 'user1', html: '<pre class="sf-dump" id="user1">user1</pre>', implicit: false },
        { output: 'user2', html: '<pre class="sf-dump" id="user2">user2</pre>', implicit: false },
      ],
      htmlReady: true,
    }
    window.Sfdump = vi.fn()
    const wrapper = mount(StackedOutput, { props: { output: [result] }, attachTo: document.body })
    await flushPromises()

    expect(wrapper.get('#user1').text()).toBe('user1')
    expect(wrapper.get('#user2').text()).toBe('user2')
    expect(window.Sfdump).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('does not hide legacy non-streaming print output behind its return dump', async () => {
    settings.outputMode = 'full'
    const result: Result = {
      line: 1,
      code: 'print $user;',
      output: '{"id":1}\n1',
      html: '<pre>1</pre>',
      implicit: false,
    }
    const wrapper = mount(StackedOutput, { props: { output: [result] }, attachTo: document.body })
    await flushPromises()

    expect(wrapper.get('#dump-1').text()).toBe('{"id":1}\n1')
    wrapper.unmount()
  })

  it('shows the printed email instead of the implicit return dump', async () => {
    const result: Result = {
      line: 8,
      code: 'print $user->email;',
      output: 'feil.noel@example.com1',
      html: '<pre>1</pre>',
      explicitOutput: 'feil.noel@example.com',
      explicitHtml: '',
      htmlReady: true,
    }
    const wrapper = mount(StackedOutput, { props: { output: [result] }, attachTo: document.body })
    await flushPromises()

    expect(wrapper.get('#dump-8').text()).toBe('feil.noel@example.com')
    expect(wrapper.find('pre').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders plain output as text, preserving markup and line breaks', async () => {
    const result: Result = {
      line: 1,
      code: 'echo $message;',
      output: '<b>hello</b>\nworld',
      html: '',
    }
    const wrapper = mount(StackedOutput, { props: { output: [result] }, attachTo: document.body })
    await flushPromises()

    expect(wrapper.get('#dump-1').element.textContent).toBe('<b>hello</b>\nworld')
    expect(wrapper.find('b').exists()).toBe(false)
    expect(wrapper.find('.whitespace-pre-wrap').exists()).toBe(true)
    wrapper.unmount()
  })
})
