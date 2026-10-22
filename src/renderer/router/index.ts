import { createRouter, createWebHashHistory } from 'vue-router'
import CodeView from '../views/CodeView.vue'
import SettingsView from '../views/SettingsView.vue'
import HomeView from '../views/HomeView.vue'
import SnippetsView from '../views/SnippetsView.vue'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/code/:id?',
      name: 'code',
      component: CodeView,
    },
    {
      path: '/snippets',
      name: 'snippets',
      component: SnippetsView,
    },
    {
      path: '/settings/:tab?',
      name: 'settings',
      component: SettingsView,
    },
  ],
})

export default router
