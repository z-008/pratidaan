import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AuthGate from './AuthGate';
import Legal, { LEGAL_PATHS } from './Legal';
import './styles.css';

const path = window.location.pathname.replace(/\/+$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {LEGAL_PATHS.includes(path) ? <Legal path={path} /> : <AuthGate />}
  </StrictMode>,
);
