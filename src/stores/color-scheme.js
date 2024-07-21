import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export const useColorSchemeStore = defineStore('color-scheme', () => {
    let storedScheme = localStorage.getItem('color-scheme')
    if (['light', 'dark'].includes(storedScheme) === false) {
        storedScheme = 'light'
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
            storedScheme = 'dark'
        }
    }
    const scheme = ref(storedScheme)

    function change(newScheme = null) {
        let setStorage = newScheme !== null
        if (newScheme === null) {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
                newScheme = 'dark'
            } else {
                newScheme = 'light'
            }
        }
        scheme.value = newScheme
        if (setStorage) {
            localStorage.setItem('color-scheme', newScheme)
        }
    }

    const isDark = computed(() => scheme.value === 'dark')

    return { scheme, change, isDark }
})
