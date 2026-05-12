import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Users, CheckCircle, XCircle } from "lucide-react";

const INVITE_TOKEN_KEY = "zawya_family_invite_token";

export function savePendingInviteToken(token: string) {
  localStorage.setItem(INVITE_TOKEN_KEY, token);
}

export function consumePendingInviteToken(): string | null {
  const token = localStorage.getItem(INVITE_TOKEN_KEY);
  if (token) localStorage.removeItem(INVITE_TOKEN_KEY);
  return token;
}

type Status = "loading" | "preview" | "accepting" | "success" | "error";

export default function JoinFamily() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, profile, loading: authLoading } = useAuth();

  const urlToken = searchParams.get("token");

  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [resolvedToken, setResolvedToken] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      if (urlToken) savePendingInviteToken(urlToken);
      setStatus("error");
      setMessage("Please log in or sign up first. Your invite will be waiting for you.");
      return;
    }

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

    setResolvedToken(token);
    previewInvite(token);
  }, [authLoading, session, profile]);

  const previewInvite = async (token: string) => {
    setStatus("loading");
    try {
      const { data, error } = await (supabase.rpc as any)("preview_family_invite", {
        _token: token,
      });

      if (data && !error) {
        const result = data as any;
        if (result.found) {
          if (result.status !== "pending") {
            setStatus("error");
            setMessage("This invite has already been used or has expired.");
            return;
          }
          setFamilyName(result.family_name || "");
        }
      }
      setStatus("preview");
    } catch {
      setStatus("preview");
    }
  };

  const acceptInvite = async () => {
    if (!resolvedToken) return;
    setStatus("accepting");
    try {
      const { data, error } = await supabase.rpc("accept_family_invite", {
        _token: resolvedToken,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        localStorage.removeItem(INVITE_TOKEN_KEY);
        setFamilyName(result.family_name || familyName || "");
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
                {status === "accepting" ? "Joining your family…" : "Loading invite…"}
              </p>
            </div>
          )}

          {status === "preview" && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                You've been invited to join{" "}
                {familyName ? (
                  <span className="font-semibold text-foreground">{familyName}</span>
                ) : (
                  "a family group"
                )}
                .
              </p>
              <p className="text-xs text-muted-foreground">
                Accepting will link your account so you can RSVP together for events.
              </p>
              <div className="flex flex-col gap-2 pt-2">
                <Button className="w-full" onClick={acceptInvite}>
                  Accept & Join Family
                </Button>
                <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                  Decline
                </Button>
              </div>
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
