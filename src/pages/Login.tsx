import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import zawyaLogo from "@/assets/logo.png";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleAppleSignIn = async () => {
    setAppleLoading(true);
    const result = await lovable.auth.signInWithOAuth("apple", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Apple sign-in failed. Please try again.");
      setAppleLoading(false);
    }
    if (result.redirected) return;
    setAppleLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });

    setLoading(false);

    if (error) {
      toast.error("Could not send magic link. Please try again.");
    } else {
      setSent(true);
      toast.success("Check your email for the magic link!");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Decorative header */}
        <div className="mb-8 text-center">
          <img src={zawyaLogo} alt="Zawya logo" className="mx-auto mb-4 h-20 w-20 object-contain" />
          <h1 className="font-heading text-3xl font-bold text-foreground">Zawya</h1>
          <p className="mt-2 text-muted-foreground">
            A gathering place for the community
          </p>
        </div>

        {sent ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <Mail className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h2 className="font-heading text-xl font-semibold text-card-foreground">
              Check your inbox
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a magic link to <strong className="text-foreground">{email}</strong>
            </p>
            <Button
              variant="ghost"
              className="mt-4 text-primary"
              onClick={() => setSent(false)}
            >
              Use a different email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="rounded-lg border border-border bg-card p-6">
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-card-foreground">
              Email address
            </label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mb-4"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Send Magic Link
            </Button>
          </form>
        )}

        <div className="mt-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="outline"
          className="mt-4 w-full gap-2"
          onClick={handleAppleSignIn}
          disabled={appleLoading}
        >
          {appleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
          )}
          Continue with Apple
        </Button>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By signing in, you agree to the community guidelines.
        </p>
      </div>
    </div>
  );
}
