import { installNetworkGuard } from './utils/networkGuard';
installNetworkGuard();
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { PocketApp } from './components/pocket/PocketApp';
import { BenchPage } from './components/pocket/BenchPage';
import { LanguageProvider } from './i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      {/[?&]bench=1/.test(window.location.search) ? <BenchPage /> : /[?&]full=1/.test(window.location.search) ? <App /> : <PocketApp />}
    </LanguageProvider>
  </StrictMode>,
);

