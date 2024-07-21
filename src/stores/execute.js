import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useExecuteStore = defineStore('execute', () => {
    const executing = ref(false)
    function setExecuting(value) {
        executing.value = value
    }

    return { executing, setExecuting }
})
