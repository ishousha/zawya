import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, FileText, Download, BookOpen, Search } from "lucide-react";
import { format } from "date-fns";

interface Resource {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Library() {
  const [selected, setSelected] = useState<Resource | null>(null);

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Resource[];
    },
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold text-foreground">Library</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and download community resources
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !resources?.length ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No resources available yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Check back later for community materials.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {resources.map((res) => (
              <Card
                key={res.id}
                className="cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]"
                onClick={() => setSelected(res)}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-heading text-base font-semibold text-foreground">{res.title}</h3>
                    {res.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{res.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                        <FileText className="h-3 w-3" /> PDF
                      </span>
                      {res.file_size && <span>{formatFileSize(res.file_size)}</span>}
                      <span>·</span>
                      <span>{format(new Date(res.created_at), "MMM d, yyyy")}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* PDF Viewer Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <DialogTitle className="font-heading text-lg truncate pr-2">
              {selected?.title}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                size="sm"
                className="gap-1.5"
                asChild
              >
                <a href={selected?.file_url} download={selected?.file_name || "document.pdf"} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {selected && (
              <iframe
                src={`${selected.file_url}#toolbar=1&navpanes=0`}
                className="h-full w-full border-0"
                title={selected.title}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
