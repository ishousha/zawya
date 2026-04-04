import { useAuth } from "@/contexts/AuthContext";

export default function PendingApproval() {
  const { signOut, profile } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-in text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent">
          <span className="font-heading text-2xl text-accent-foreground">⏳</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Pending Approval
        </h1>
        <p className="mt-3 text-muted-foreground">
          Welcome{profile?.name ? `, ${profile.name}` : ""}! Your account is awaiting
          admin approval. You'll receive access once approved.
        </p>
        <button
          onClick={signOut}
          className="mt-6 text-sm text-primary underline underline-offset-2 hover:text-emerald-light"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
