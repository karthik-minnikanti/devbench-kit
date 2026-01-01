import React from 'react';
import ReactDOM from 'react-dom/client';
import { DailyPlanner } from './components/DailyPlanner';
import './styles/index.css';
import { ToastProvider } from './components/ToastProvider';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <div className="h-screen w-screen overflow-hidden">
        <DailyPlanner />
      </div>
    </ToastProvider>
  </React.StrictMode>,
);






