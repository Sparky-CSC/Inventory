import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App.jsx';
import '@/index.css';
import { registerServiceWorker } from '@/lib/registerServiceWorker';

// Sign-in emails can send people back with a message after the "#"
// (for example "#error=access_denied…"). That is not a page in the app, so
// tidy it away before the app starts.
if (/^#(error|access_token|message)=/.test(window.location.hash)) {
  const details = new URLSearchParams(window.location.hash.slice(1));
  const problem = details.get('error_description') || details.get('message');
  if (problem) {
    try {
      sessionStorage.setItem('theatre_inventory_link_message', problem.replace(/\+/g, ' '));
    } catch {
      /* ignore */
    }
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

registerServiceWorker();
