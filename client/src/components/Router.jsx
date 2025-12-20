import React, { useEffect, useMemo, useState } from 'react';
import StickerboardsDemo from '../StickerboardsDemo.jsx';
import BoardView from './board/BoardView.jsx';

// Tiny hash-based router. It listens to window.location.hash and renders
// the correct view. Routes supported:
// - #/board                 → list of boards (StickerboardsDemo)
// - #/board/:token          → a specific board by id or slug (BoardView)
// - otherwise               → simple home message
export default function Router() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const route = useMemo(() => {
    // Normalize: ensure it always starts with '#/'
    const h = hash.startsWith('#') ? hash : `#/${hash}`;
    // Remove leading '#'
    const path = h.slice(1);
    const parts = path.split('/').filter(Boolean); // ["", "board", ...] → ["board", ...]

    return { parts };
  }, [hash]);

  // Routing logic
  if (route.parts.length === 0) {
    return <Home />;
  }

  const [first, second] = route.parts;

  if (first === 'board' && !second) {
    // #/board
    return <StickerboardsDemo />;
  }

  if (first === 'board' && second) {
    // #/board/:token — require auth token to view a private board
    const hasToken = !!localStorage.getItem('token');
    if (!hasToken) {
      // Redirect unauthenticated users to default public route
      if (window.location.hash !== '#/') {
        window.location.hash = '#/';
      }
      return <Home />;
    }
    return <BoardView token={second} />;
  }

  // Fallback
  return <NotFound hash={hash} />;
}

function Home() {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Welcome</h2>
      <p>Select an item from the navbar to load data.</p>
    </div>
  );
}

function NotFound({ hash }) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Not Found</h2>
      <p>No route matches <code>{hash}</code>.</p>
    </div>
  );
}
