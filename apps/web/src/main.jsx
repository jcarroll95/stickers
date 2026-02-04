import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import '../styles/globals.css';
import './styles/base.css';
import './index.css';
import Navbar from './components/Navbar.jsx';
import Router from './components/Router.jsx';
import GlobalErrorBoundary from './components/common/GlobalErrorBoundary.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <GlobalErrorBoundary>
            <Toaster position="top-right" reverseOrder={false} />
            <Navbar />
            <div className="main-content">
                <Router />
            </div>
        </GlobalErrorBoundary>
    </React.StrictMode>
);