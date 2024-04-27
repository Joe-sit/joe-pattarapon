import { createRouter, createWebHistory } from "vue-router";
import PortfolioPage from '../components/views/PortfolioPage.vue'
import NotFoundPage from '../components/views/NotFoundPage.vue'
import HomePage from '../components/views/HomePage.vue'

const history = createWebHistory()

const routes = [

    {
        path: '/',
        name: 'HomePage',
        component: HomePage
    },
    {
        path: '/portfolio',
        name: 'Portfolio',
        component: PortfolioPage

    },
    {
        path: '/:catchNotMatchPath(.*)',
        name: 'NotFound',
        component: NotFoundPage
    }

]

const router = createRouter({ history, routes })
export default router