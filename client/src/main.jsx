import React from 'react';
import ReactDOM from 'react-dom/client';
import '../styles/globals.css';
import './styles/base.css';
import './index.css';
import Navbar from './components/Navbar.jsx';
import Router from './components/Router.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Navbar />
        <div className="main-content">
            <Router />
        </div>
    </React.StrictMode>
);