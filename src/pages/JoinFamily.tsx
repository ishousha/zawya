import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Users, CheckCircle, XCircle } from "lucide-react";

export default function JoinFamily() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { session, profile } = useAuth();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "ready" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No invite token provided.");
      return;
    }
    if (!session) {
      setStatus("error");
      setMessage("Please log in first, then open this link again.");
      return;
    }
    if ((profile as any)?.family_id) {
      setStatus("error");
      setMessage("You are already part of a family. You cannot join another.");
      return;
    }
    setStatus("ready");
  }, [token, session, profile]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    try {
      const { data, error } = await supabase.rpc("accept_family_invite", {
        _token: token,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.success) {
        setFamilyName(result.family_name || "");
        setStatus("success");
        toast.success(`Welcome to ${result.family_name || "your new family"}!`);
      } else {
        setStatus("error");
        setMessage(result?.error || "Failed to accept invite.");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Something went wrong.");
    } finally {
      setAccepting(false);
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
          {status === "loading" && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {status === "ready" && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                You've been invited to join a family group. Accept to share RSVPs and attend events together.
              </p>
              <Button className="w-full" onClick={handleAccept} disabled={accepting}>
                {accepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accept Invite
              </Button>
            </>
          )}

          {status === "success" && (
            <div className="text-center space-y-3">
              <CheckCircle className="mx-auto h-10 w-10 text-primary" />
              <p className="text-sm font-medium text-foreground">
                You've joined <span className="text-primary">{familyName}</span>!
              </p>
              <Button className="w-full" onClick={() => navigate("/")}>
                Go to Home
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="text-center space-y-3">
              <XCircle className="mx-auto h-10 w-10 text-destructive" />
              <p className="text-sm text-destructive">{message}</p>
              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                Go to Home
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
