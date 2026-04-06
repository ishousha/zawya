import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, MapPinOff } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="text-center max-w-sm mx-auto animate-fade-in">
        {/* Illustration */}
        <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-muted">
          <MapPinOff className="h-14 w-14 text-muted-foreground/60" strokeWidth={1.5} />
        </div>

        <h1 className="mb-2 font-heading text-5xl font-bold text-foreground">404</h1>
        <p className="mb-1 font-heading text-xl text-foreground">Page Not Found</p>
        <p className="mb-8 text-sm text-muted-foreground leading-relaxed">
          The page you're looking for doesn't exist or may have been moved. Let's get you back on track.
        </p>

        <Button asChild size="lg" className="gap-2">
          <Link to="/">
            <Home className="h-4 w-4" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
