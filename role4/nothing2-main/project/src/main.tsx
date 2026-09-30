import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Paint the application first. Some injected wallet providers expose guarded
// properties; their initialization must never prevent React from mounting.
void import('./provider-wrapper').catch((error: unknown) => {
  console.error('Sentinel wallet interceptor failed to load.', error);
  window.__sentinelInterceptorError =
    'The wallet interceptor could not start. Reload after MetaMask finishes loading.';
});
