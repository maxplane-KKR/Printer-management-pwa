import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/ibm-plex-sans-thai/400.css';
import '@fontsource/ibm-plex-sans-thai/600.css';
import './styles/globals.css';
import { App } from './app/App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
