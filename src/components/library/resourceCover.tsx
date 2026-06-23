import { useEffect, useState } from "react";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/runtime-client";
import CoverFallback from "./CoverFallback";

// Module-level cache so signed URLs survive remounts and re-renders.
const coverUrlCache = new Map<string, { url: string; expires: number }>();

export function useCoverSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => {
    if (!path) return null;
    const hit = coverUrlCache.get(path);
    return hit && hit.expires > Date.now() ? hit.url : null;
  });
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    const hit = coverUrlCache.get(path);
    if (hit && hit.expires > Date.now()) { setUrl(hit.url); return; }
    let cancelled = false;
    supabase.storage.from("resource-covers").createSignedUrl(path, 3600).then(({ data }) => {
      if (cancelled || !data?.signedUrl) return;
      coverUrlCache.set(path, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
      setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

export function ResourceCover({
  res, speakerImage, eventCover, Icon, label, rounded = "rounded-2xl", showLabel = false,
}: {
  res: { id: string; cover_image_url?: string | null };
  speakerImage?: string | null;
  eventCover?: string | null;
  Icon: typeof FileText;
  label?: string;
  rounded?: string;
  showLabel?: boolean;
}) {
  const signed = useCoverSignedUrl(res.cover_image_url ?? null);
  const src = signed || speakerImage || eventCover || null;
  return (
    <div className={`w-full h-full overflow-hidden ${rounded}`}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <CoverFallback seed={res.id} Icon={Icon} label={showLabel ? label : undefined} />
      )}
    </div>
  );
}
