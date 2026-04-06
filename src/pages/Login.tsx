import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Mail, Loader2, ArrowLeft, RefreshCw, Clock } from "lucide-react";
import zawyaLogo from "@/assets/logo.png";

type Stage = "email" | "otp";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<Stage>("email");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiry, setOtpExpiry] = useState(0);
  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startExpiryTimer = () => {
    if (expiryRef.current) clearInterval(expiryRef.current);
    setOtpExpiry(300); // 5 minutes
    expiryRef.current = setInterval(() => {
      setOtpExpiry((prev) => {
        if (prev <= 1) {
          if (expiryRef.current) clearInterval(expiryRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    return () => { if (expiryRef.current) clearInterval(expiryRef.current); };
  }, []);

  const handleOAuthSignIn = async (provider: "apple" | "google") => {
    const setLoaderFn = provider === "apple" ? setAppleLoading : setGoogleLoading;
    setLoaderFn(true);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error(`${provider === "apple" ? "Apple" : "Google"} sign-in failed. Please try again.`);
      setLoaderFn(false);
    }
    if (result.redirected) return;
    setLoaderFn(false);
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      email,
    });

    setLoading(false);

    if (error) {
      toast.error("Could not send code. Please try again.");
    } else {
      setStage("otp");
      startExpiryTimer();
      toast.success("Code sent! Check your email.");
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.length !== 6) return;
    setVerifying(true);

    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    setVerifying(false);

    if (error) {
      toast.error("Invalid or expired code. Please try again.");
      setOtp("");
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setResending(false);
    if (error) {
      toast.error("Could not resend code. Please try again.");
    } else {
      toast.success("New code sent!");
      setOtp("");
      startExpiryTimer();
      setResendCooldown(30);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) { clearInterval(interval); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
  };

  const handleBack = () => {
    setStage("email");
    setOtp("");
    setResendCooldown(0);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-in">
        {/* Header */}
        <div className="mb-8 text-center">
          <img src={zawyaLogo} alt="Zawya logo" className="mx-auto mb-4 h-20 w-20 object-contain" />
          <h1 className="font-heading text-3xl font-bold text-foreground">Zawya</h1>
          <p className="mt-2 text-muted-foreground">
            A gathering place for the community
          </p>
        </div>

        {stage === "otp" ? (
          <div className="rounded-lg border border-border bg-card p-6 text-center">
            <Mail className="mx-auto mb-3 h-10 w-10 text-primary" />
            <h2 className="font-heading text-xl font-semibold text-card-foreground">
              Enter your code
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              We emailed you a code to{" "}
              <strong className="text-foreground">{email}</strong>, enter it here:
            </p>

            <div className="mt-6 flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="h-12 w-12 text-lg border-input focus-within:ring-primary" />
                  <InputOTPSlot index={1} className="h-12 w-12 text-lg border-input focus-within:ring-primary" />
                  <InputOTPSlot index={2} className="h-12 w-12 text-lg border-input focus-within:ring-primary" />
                  <InputOTPSlot index={3} className="h-12 w-12 text-lg border-input focus-within:ring-primary" />
                  <InputOTPSlot index={4} className="h-12 w-12 text-lg border-input focus-within:ring-primary" />
                  <InputOTPSlot index={5} className="h-12 w-12 text-lg border-input focus-within:ring-primary" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              className="mt-6 w-full"
              onClick={handleVerifyOtp}
              disabled={verifying || otp.length !== 6}
            >
              {verifying ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Continue
            </Button>

            <div className="mt-4 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Change email
              </button>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resending || resendCooldown > 0}
                className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? "animate-spin" : ""}`} />
                {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : "Resend code"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSendOtp} className="rounded-lg border border-border bg-card p-6">
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
              Send Code
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
          onClick={() => handleOAuthSignIn("google")}
          disabled={googleLoading}
        >
          {googleLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          Continue with Google
        </Button>

        <Button
          variant="outline"
          className="mt-3 w-full gap-2"
          onClick={() => handleOAuthSignIn("apple")}
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
