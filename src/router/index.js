import { createRouter, createWebHistory } from "vue-router";
import PortfolioPage from '../components/views/PortfolioPage.vue'
import NotFoundPage from '../components/views/NotFoundPage.vue'
import HomePage from '../components/views/HomePage.vue'
import PortfolioDetails from '../components/views/PortfolioDetails.vue'
import AboutPage from '../components/views/AboutPage.vue'
import EkycDetails from '../components/views/EkycDetails.vue'


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
    },
    {
        path: '/portfolio/:portId',
        name: 'PortfolioDetails',
        component: PortfolioDetails
    },
    {
        path: '/about',
        name: 'AboutPage',
        component: AboutPage
    },
    {
        path: '/portfolio/2',
        name: 'EkycDetails',
        component: EkycDetails
    }



]

const router = createRouter({ history, routes })
export default router