import { createBrowserRouter } from 'react-router';
import { routes } from './routes';

export { seasonLoader } from './routes';

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(routes, { basename });
