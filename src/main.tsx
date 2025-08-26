import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { totelepepExtractor } from './services/totelepepExtractor';

// Make extractor available globally for debugging
(window as any).totelepepExtractor = totelepepExtractor;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
