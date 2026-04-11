import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Plus, Edit2, Trash2, X, User } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Speaker {
  id: string;
  name: string;
  bio: string | null;
  image_url: string | null;
}

export default function SpeakerManagement() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Speaker | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: speakers, isLoading } = useQuery({
    queryKey: ["speakers"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speakers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Speaker[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("speakers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speakers"] });
      toast.success("Special guest removed");
    },
    onError: () => toast.error("Failed to delete special guest"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (creating || editing) {
    return (
      <SpeakerForm
        speaker={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-4 py-4">
      <Button onClick={() => setCreating(true)} className="w-full gap-2 h-12">
        <Plus className="h-5 w-5" /> Add New Special Guest
      </Button>

      {speakers && speakers.length > 0 ? (
        <div className="space-y-2">
          {speakers.map((speaker) => (
            <Card key={speaker.id}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {speaker.image_url ? (
                      <AvatarImage src={speaker.image_url} alt={speaker.name} />
                    ) : null}
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-card-foreground">{speaker.name}</p>
                    {speaker.bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {speaker.bio}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9"
                      onClick={() => setEditing(speaker)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {speaker.name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove this special guest. Events linked to them will have their special guest unset.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(speaker.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-8">
          No special guests yet. Add guest speakers and Sheikhs here.
        </p>
      )}
    </div>
  );
}

function SpeakerForm({ speaker, onClose }: { speaker: Speaker | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(speaker?.name ?? "");
  const [bio, setBio] = useState(speaker?.bio ?? "");
  const [imageUrl, setImageUrl] = useState(speaker?.image_url ?? "");
  const [uploading, setUploading] = useState(false);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        bio: bio || null,
        image_url: imageUrl || null,
      };
      if (speaker) {
        const { error } = await supabase.from("speakers").update(payload).eq("id", speaker.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("speakers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speakers"] });
      toast.success(speaker ? "Special guest updated" : "Special guest added");
      onClose();
    },
    onError: () => toast.error("Failed to save special guest"),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be under 5 MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `speakers/${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setImageUrl(data.publicUrl);
      toast.success("Photo uploaded");
    } catch (err: any) {
      console.error("Special guest photo upload error:", err);
      toast.error(err?.message || "Failed to upload photo");
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      e.target.value = "";
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-semibold">
            {speaker ? "Edit Special Guest" : "Add Special Guest"}
          </h3>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <Avatar className="h-20 w-20">
            {imageUrl ? <AvatarImage src={imageUrl} /> : null}
            <AvatarFallback>
              <User className="h-8 w-8" />
            </AvatarFallback>
          </Avatar>
          <div>
            <Label htmlFor="speaker-photo" className="cursor-pointer text-sm text-primary hover:underline">
              {uploading ? "Uploading…" : "Upload Photo"}
            </Label>
            <input
              id="speaker-photo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={uploading}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="speaker-name">Name *</Label>
          <Input
            id="speaker-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Sheikh Ahmed, Dr. Fatima…"
            className="mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="speaker-bio">Bio</Label>
          <Textarea
            id="speaker-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Brief biography or description…"
            rows={4}
            className="mt-1.5"
          />
        </div>

        <Button
          className="w-full h-12"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !name.trim()}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {speaker ? "Update Special Guest" : "Add Special Guest"}
        </Button>
      </CardContent>
    </Card>
  );
}
