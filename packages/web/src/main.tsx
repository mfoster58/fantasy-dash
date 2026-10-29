import ReactDOM from 'react-dom/client';
import { initTheme } from './lib/theme';
import { routes } from './routes';
import { legacyHeads, resolveLeague } from './lib/league';
import { start } from './boot';
import { defaultLeague, leagues } from '../../../league.config';
import './index.css';

initTheme();
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
const root = ReactDOM.createRoot(document.getElementById('root')!);
const where = resolveLeague({ pathname: location.pathname, rest: location.search + location.hash, base, leagues, legacy: legacyHeads(routes), defaultSlug: defaultLeague });
void start({ where, base, render: (el) => root.render(el), replace: (to) => location.replace(to) });
