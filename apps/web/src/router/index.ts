import { createRouter, createWebHistory } from 'vue-router';
import { useSession } from '@/stores/session';

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue') },
    { path: '/login', name: 'login', component: () => import('@/pages/AuthPage.vue'), meta: { guestOnly: true, bare: true } },
    { path: '/register', name: 'register', component: () => import('@/pages/AuthPage.vue'), meta: { guestOnly: true, bare: true } },
    { path: '/history', name: 'history', component: () => import('@/pages/HistoryPage.vue') },
    { path: '/credits', name: 'credits', component: () => import('@/pages/CreditsPage.vue'), meta: { auth: true } },
    { path: '/profile', name: 'profile', component: () => import('@/pages/ProfilePage.vue'), meta: { auth: true } },
    {
      path: '/admin',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { auth: true, admin: true, bare: true },
      children: [
        { path: '', name: 'admin', component: () => import('@/pages/admin/AdminDashboardPage.vue'), meta: { title: 'ផ្ទាំងសង្ខេប' } },
        { path: 'users', name: 'admin-users', component: () => import('@/pages/admin/AdminUsersPage.vue'), meta: { title: 'អ្នកប្រើប្រាស់' } },
        { path: 'requests', name: 'admin-requests', component: () => import('@/pages/admin/AdminRequestsPage.vue'), meta: { title: 'សំណើក្រេឌីត' } },
        { path: 'conversions', name: 'admin-conversions', component: () => import('@/pages/admin/AdminConversionsPage.vue'), meta: { title: 'ការបម្លែងទាំងអស់' } },
        { path: 'settings', name: 'admin-settings', component: () => import('@/pages/admin/AdminSettingsPage.vue'), meta: { title: 'ការកំណត់' } },
      ],
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
  ],
});

router.beforeEach(async (to) => {
  const session = useSession();
  await session.init();
  if (to.meta.auth && !session.user) return { name: 'login', query: { next: to.fullPath } };
  if (to.meta.admin && !session.isAdmin) return { name: 'home' };
  if (to.meta.guestOnly && session.user) return { name: 'home' };
});
