import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import logger from "@/lib/logger";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    logger.warn('Router', `404: User attempted to access non-existent route: ${location.pathname}`);
    document.title = '404 — Page Not Found | Berozgar';
    return () => { document.title = 'Berozgar'; };
  }, [location.pathname]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black text-white">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-6 text-xl text-white/70">Oops! Page not found</p>
        <Button asChild variant="primary" size="lg">
          <Link to="/home">Go back home</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
