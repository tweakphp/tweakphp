<script setup lang="ts">
  import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
  import Container from '../components/Container.vue'
  import { useSettingsStore } from '../stores/settings'
  import AboutSettings from './settings/AboutSettings.vue'
  import GeneralSettings from './settings/GeneralSettings.vue'
  import LoadersSettings from './settings/LoadersSettings.vue'
  import MCPSettings from './settings/MCPSettings.vue'
  import { useRoute } from 'vue-router'
  import AiAutocompleteSetting from '@/views/settings/AiAutocompleteSetting.vue'

  const sections = [
    { id: 'general', label: 'General' },
    { id: 'ai', label: 'AI Completion' },
    { id: 'loaders', label: 'Loaders' },
    { id: 'mcp', label: 'MCP Server' },
    { id: 'about', label: 'About' },
  ] as const

  type SectionId = (typeof sections)[number]['id']

  const settingsStore = useSettingsStore()
  const route = useRoute()
  const scrollContainerRef = ref<HTMLElement | null>(null)
  const activeSection = ref<SectionId>('general')
  let scrollingTo: SectionId | null = null
  let scrollResetTimer: ReturnType<typeof setTimeout> | undefined

  const isSectionId = (value: unknown): value is SectionId => {
    return typeof value === 'string' && sections.some(section => section.id === value)
  }

  const getScrollContainer = (): HTMLElement | null => {
    return scrollContainerRef.value
  }

  const getSectionElement = (id: SectionId): HTMLElement | null => {
    return document.getElementById(`settings-${id}`)
  }

  const updateActiveSection = () => {
    const container = getScrollContainer()

    if (!container || scrollingTo) return

    const activationPoint = container.getBoundingClientRect().top + Math.min(120, container.clientHeight / 3)
    let currentSection: SectionId = sections[0].id

    for (const section of sections) {
      const element = getSectionElement(section.id)
      if (element && element.getBoundingClientRect().top <= activationPoint) {
        currentSection = section.id
      }
    }

    const isScrollable = container.scrollHeight > container.clientHeight + 1
    const isAtBottom = isScrollable && container.scrollTop + container.clientHeight >= container.scrollHeight - 2
    activeSection.value = isAtBottom ? sections[sections.length - 1].id : currentSection
  }

  const scrollToSection = (id: SectionId, smooth = true) => {
    const element = getSectionElement(id)
    if (!element) return

    if (scrollResetTimer) clearTimeout(scrollResetTimer)

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = smooth && !reduceMotion ? 'smooth' : 'auto'
    activeSection.value = id
    scrollingTo = behavior === 'smooth' ? id : null

    element.scrollIntoView({ behavior, block: 'start' })

    if (behavior === 'smooth') {
      scrollResetTimer = setTimeout(() => {
        scrollingTo = null
        updateActiveSection()
      }, 700)
    }
  }

  onMounted(async () => {
    await nextTick()
    const initialSection = isSectionId(route.params.tab) ? route.params.tab : 'general'
    scrollToSection(initialSection, false)
    updateActiveSection()
  })

  onBeforeUnmount(() => {
    if (scrollResetTimer) clearTimeout(scrollResetTimer)
  })
</script>

<template>
  <Container class="pt-[38px] !overflow-hidden no-scrollbar">
    <div ref="scrollContainerRef" class="h-full overflow-y-auto no-scrollbar" @scroll="updateActiveSection">
      <div class="mx-auto grid w-full max-w-6xl grid-cols-[160px_minmax(0,1fr)] items-start gap-x-8 px-8">
        <aside class="sticky top-8 col-start-1 row-start-2 mt-8 self-start">
          <nav aria-label="Settings sections" class="border-l" :style="{ borderColor: settingsStore.colors.border }">
            <a
              v-for="section in sections"
              :key="section.id"
              :href="`#settings-${section.id}`"
              class="relative block whitespace-nowrap px-4 py-2 text-sm transition-colors"
              :class="
                activeSection === section.id
                  ? 'text-primary-500 font-medium'
                  : 'opacity-60 hover:text-primary-500 hover:opacity-100'
              "
              :aria-current="activeSection === section.id ? 'location' : undefined"
              @click.prevent="scrollToSection(section.id)"
            >
              <span
                class="absolute -left-px inset-y-0 w-0.5 rounded-full bg-primary-500 transition-opacity"
                :class="activeSection === section.id ? 'opacity-100' : 'opacity-0'"
              ></span>
              {{ section.label }}
            </a>
          </nav>
        </aside>

        <div class="col-start-2 row-start-2 mt-8 min-w-0 w-full max-w-3xl space-y-12 pb-24">
          <div class="col-start-2 row-start-1">
            <h1 class="text-3xl font-semibold tracking-tight">Settings</h1>
          </div>

          <section id="settings-general" aria-label="General settings" class="scroll-mt-[10px]">
            <GeneralSettings />
          </section>

          <section id="settings-ai" aria-label="AI Completion settings" class="scroll-mt-[10px]">
            <AiAutocompleteSetting />
          </section>

          <section id="settings-loaders" aria-label="Loaders settings" class="scroll-mt-[10px]">
            <LoadersSettings />
          </section>

          <section id="settings-mcp" aria-label="MCP Server settings" class="scroll-mt-[10px]">
            <MCPSettings />
          </section>

          <section id="settings-about" aria-label="About TweakPHP" class="scroll-mt-[10px]">
            <AboutSettings />
          </section>
        </div>
      </div>
    </div>
  </Container>
</template>

<style scoped></style>
