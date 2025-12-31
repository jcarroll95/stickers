import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import StickerboardsDemo from '../StickerboardsDemo.jsx';
import BoardView from './board/BoardView.jsx';
import Explore from './explore/Explore.jsx';
import RegisterVerify from './auth/RegisterVerify.jsx';
import CreateStickerboard from './board/CreateStickerboard.jsx';
import useAuthStore from '../store/authStore';

/**
 * Router Component
 * Tiny hash-based router. It listens to window.location.hash and renders
 * the correct view.
 * 
 * Routes supported:
 * - #/board                 → list of boards (StickerboardsDemo)
 * - #/board/:token          → a specific board by id or slug (BoardView)
 * - #/explore               → public gallery
 * - #/register              → registration flow
 * - otherwise               → simple home message
 */
export default function Router() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  const { isAuthenticated } = useAuthStore();

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
    // Separate query if present (e.g., #/register/verify?email=x@y.z)
    const [pathOnly, queryString] = path.split('?');
    const parts = pathOnly.split('/').filter(Boolean); // ["", "board", ...] → ["board", ...]
    const searchParams = new URLSearchParams(queryString || '');

    return { parts, searchParams };
  }, [hash]);

  // Routing logic
  if (route.parts.length === 0) {
    return <Home />;
  }

  const [first, second] = route.parts;

  if (first === 'register') {
    // Public registration routes
    if (second === 'verify') {
      const initialEmail = route.searchParams.get('email') || '';
      return <RegisterVerify mode="verify" initialEmail={initialEmail} />;
    }
    return <RegisterVerify />;
  }

  if (first === 'board' && !second) {
    // #/board
    return <StickerboardsDemo />;
  }

  if (first === 'explore') {
    // Public explore page: paginated thumbnails of stickerboards
    return <Explore />;
  }

  if (first === 'board' && second === 'create') {
    // #/board/create — requires auth
    if (!isAuthenticated) {
      if (window.location.hash !== '#/') {
        window.location.hash = '#/';
      }
      return <Home />;
    }
    return <CreateStickerboard />;
  }

  if (first === 'board' && second) {
    // #/board/:token — require auth token to view a private board
    if (!isAuthenticated) {
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

/**
 * Home Component
 */
function Home() {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Welcome</h2>
      <p>Select an item from the navbar to load data.</p>
    </div>
  );
}

/**
 * NotFound Component
 */
function NotFound({ hash }) {
  return (
    <div style={{ padding: '1rem' }}>
      <h2>Not Found</h2>
      <p>No route matches <code>{hash}</code>.</p>
    </div>
  );
}

NotFound.propTypes = {
  hash: PropTypes.string.isRequired,
};
