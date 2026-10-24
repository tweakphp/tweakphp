<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

  const props = withDefaults(
    defineProps<{
      /** Seconds to wait on hover before the marquee starts scrolling */
      delay?: number
      /** Scrolling speed in pixels per second */
      speed?: number
      /** Pixels of empty space between the end of the text and its next repetition */
      gap?: number
    }>(),
    {
      delay: 1,
      speed: 40,
      gap: 48,
    }
  )

  const container = ref<HTMLElement | null>(null)
  const running = ref(false)
  const distance = ref(0)

  const duration = computed(() => (props.speed > 0 ? distance.value / props.speed : 0))

  let startTimer: ReturnType<typeof setTimeout> | null = null
  let resizeObserver: ResizeObserver | null = null
  let textOverflows = false

  const clearStartTimer = () => {
    if (startTimer !== null) {
      clearTimeout(startTimer)
      startTimer = null
    }
  }

  // On the resting layout (plain inline text) scrollWidth reports the full,
  // untruncated text width: overflow detection and scroll distance in one read.
  const measure = () => {
    if (!container.value || running.value) {
      return
    }
    textOverflows = container.value.scrollWidth - container.value.clientWidth > 1
  }

  const start = () => {
    if (!container.value) {
      return
    }
    distance.value = container.value.scrollWidth + props.gap
    running.value = true
  }

  const handleMouseEnter = () => {
    measure()
    if (!textOverflows) {
      return
    }
    clearStartTimer()
    startTimer = setTimeout(() => {
      measure()
      if (textOverflows) {
        start()
      }
    }, props.delay * 1000)
  }

  const handleMouseLeave = () => {
    clearStartTimer()
    running.value = false
  }

  onMounted(() => {
    if (!container.value) {
      return
    }
    measure()
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(container.value)
    document.fonts?.ready.then(measure).catch(() => {})
  })

  onBeforeUnmount(() => {
    clearStartTimer()
    resizeObserver?.disconnect()
    resizeObserver = null
  })
</script>

<template>
  <span
    ref="container"
    class="block min-w-0 overflow-hidden whitespace-nowrap"
    :class="{ truncate: !running }"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <span
      v-if="running"
      class="marquee-track"
      :style="{
        '--marquee-distance': `${-distance}px`,
        '--marquee-duration': `${duration}s`,
      }"
    >
      <span class="inline-block" :style="{ paddingRight: `${gap}px` }"><slot /></span>
      <span class="inline-block" aria-hidden="true"><slot /></span>
    </span>
    <template v-else>
      <slot />
    </template>
  </span>
</template>

<style scoped>
  .marquee-track {
    display: inline-block;
    will-change: transform;
    animation: marquee-scroll var(--marquee-duration, 10s) linear infinite;
  }

  @keyframes marquee-scroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(var(--marquee-distance, -100px));
    }
  }
</style>
