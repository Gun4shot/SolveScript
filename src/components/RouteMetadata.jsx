import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function RouteMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const home = pathname === '/';
    document.querySelector('meta[name="robots"]')?.setAttribute('content', home ? 'index, follow' : 'noindex, follow');
  }, [pathname]);
  return null;
}
