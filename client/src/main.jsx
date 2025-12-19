import React from 'react';
import ReactDOM from 'react-dom/client';
import Navbar from './components/Navbar.jsx';
import StickerboardsDemo from './StickerboardsDemo.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Navbar />
        <div className="main-content">
            <StickerboardsDemo />
        </div>
    </React.StrictMode>
);