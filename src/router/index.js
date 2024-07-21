import { createRouter, createWebHistory } from 'vue-router'
import CodeView from '@/views/CodeView.vue'
import SettingsView from '@/views/SettingsView.vue'
import SSHView from '@/views/SSHView.vue'
import SSHConnectView from '@/views/SSHConnectView.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: CodeView,
        },
        {
            path: '/code/:id?',
            name: 'code',
            component: CodeView,
        },
        {
            path: '/settings',
            name: 'settings',
            component: SettingsView,
        },
        {
            path: '/ssh',
            name: 'ssh',
            component: SSHView,
        },
        {
            path: '/ssh/connect',
            name: 'ssh.connect',
            component: SSHConnectView,
        },
    ],
})

export default router
