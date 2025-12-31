import React, { useEffect, useMemo, useState, Suspense, lazy } from 'react';
import PropTypes from 'prop-types';
import useAuthStore from '../store/authStore';
import LoadingSpinner from './common/LoadingSpinner.jsx';

// Lazy load major route components
const StickerboardsDemo = lazy(() => import('../StickerboardsDemo.jsx'));
const BoardView = lazy(() => import('./board/BoardView.jsx'));
const Explore = lazy(() => import('./explore/Explore.jsx'));
const RegisterVerify = lazy(() => import('./auth/RegisterVerify.jsx'));
const CreateStickerboard = lazy(() => import('./board/CreateStickerboard.jsx'));
const MetricsDashboard = lazy(() => import('./admin/MetricsDashboard.jsx'));
const UserManager = lazy(() => import('./admin/UserManager.jsx'));

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
  const { isAuthenticated, user } = useAuthStore();

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

  const [first, second] = route.parts;

  // Handle redirects via useEffect to avoid modifying window.location during render
  useEffect(() => {
    const isBoardCreate = first === 'board' && second === 'create';
    const isBoardToken = first === 'board' && second && second !== 'create';

    if ((isBoardCreate || isBoardToken) && !isAuthenticated) {
      if (window.location.hash !== '#/') {
        window.location.hash = '#/';
      }
    }
  }, [first, second, isAuthenticated]);

  // Routing logic wrapped in Suspense for Code Splitting
  return (
    <Suspense fallback={<LoadingSpinner message="Loading page..." />}>
      {renderContent()}
    </Suspense>
  );

  function renderContent() {
    if (route.parts.length === 0) {
      return <Home />;
    }

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
        return <Home />;
      }
      return <CreateStickerboard />;
    }

    if (first === 'board' && second) {
      // #/board/:token — require auth token to view a private board
      if (!isAuthenticated) {
        // Redirect unauthenticated users to default public route
        return <Home />;
      }
      return <BoardView token={second} />;
    }

    if (first === 'admin' && second === 'metrics') {
      // #/admin/metrics — require admin role
      if (!isAuthenticated || user?.role !== 'admin') {
        return <Home />;
      }
      return <MetricsDashboard />;
    }

    if (first === 'admin' && second === 'users') {
      // #/admin/users — require admin role
      if (!isAuthenticated || user?.role !== 'admin') {
        return <Home />;
      }
      return <UserManager />;
    }

    // Fallback
    return <NotFound hash={hash} />;
  }
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
