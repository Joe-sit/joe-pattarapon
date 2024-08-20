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
        component: PortfolioDetails,
        props: route => ({ portId: Number(route.params.id) })  // Pass route params as props
    },
    {
        path: '/about',
        name: 'AboutPage',
        component: AboutPage
    },
    




]

const router = createRouter({ history: createWebHistory(), routes })


export default router