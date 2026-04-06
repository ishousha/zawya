import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Users, CheckCircle, XCircle } from "lucide-react";

const INVITE_TOKEN_KEY = "zawya_family_invite_token";

/** Save a pending invite token so it survives login/signup redirect */
export function savePendingInviteToken(token: string) {
  localStorage.setItem(INVITE_TOKEN_KEY, token);
}

/** Read and clear the stored invite token */
export function consumePendingInviteToken(): string | null {
  const token = localStorage.getItem(INVITE_TOKEN_KEY);
  if (token) localStorage.removeItem(INVITE_TOKEN_KEY);
  return token;
}

export default function JoinFamily() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  // Token from URL or from localStorage (after login redirect)
  const urlToken = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "ready" | "accepting" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [familyName, setFamilyName] = useState("");

  // On mount: if we have a URL token but no session, save it and let the login page handle it
  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      // Save token so it persists through login
      if (urlToken) {
        savePendingInviteToken(urlToken);
      }
      setStatus("error");
      setMessage("Please log in or sign up first. Your invite will be waiting for you.");
      return;
    }

    // User is authenticated — resolve the token
    const token = urlToken || consumePendingInviteToken();
    if (!token) {
      setStatus("error");
      setMessage("No invite token provided.");
      return;
    }

    if ((profile as any)?.family_id) {
      setStatus("error");
      setMessage("You are already part of a family. You cannot join another.");
      return;
    }

    // Auto-accept the invite
    acceptInvite(token);
  }, [authLoading, session, profile]);

  const acceptInvite = async (token: string) => {
    setStatus("accepting");
    try {
      const { data, error } = await supabase.rpc("accept_family_invite", {
        _token: token,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        // Clear any stored token
        localStorage.removeItem(INVITE_TOKEN_KEY);
        setFamilyName(result.family_name || "");
        setStatus("success");
        toast.success(`You have successfully joined ${result.family_name || "the family"}!`);
      } else {
        setStatus("error");
        setMessage(result?.error || "This invite is no longer valid.");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Users className="mx-auto h-10 w-10 text-primary mb-2" />
          <CardTitle className="font-heading text-xl">Family Invite</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {(status === "loading" || status === "accepting") && (
            <div className="text-center space-y-3 py-4">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {status === "accepting" ? "Joining your family…" : "Loading…"}
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center space-y-3">
              <CheckCircle className="mx-auto h-12 w-12 text-primary" />
              <h2 className="font-heading text-lg font-semibold text-foreground">
                You have successfully joined the family!
              </h2>
              <p className="text-sm text-muted-foreground">
                Welcome to <span className="font-medium text-foreground">{familyName}</span>. You can now RSVP together for events.
              </p>
              <Button className="w-full mt-2" onClick={() => navigate("/")}>
                Go to Home
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-3">
              <XCircle className="mx-auto h-10 w-10 text-destructive" />
              <p className="text-sm text-muted-foreground">{message}</p>
              {!session ? (
                <Button className="w-full" onClick={() => navigate("/")}>
                  Log In / Sign Up
                </Button>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                  Go to Home
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
