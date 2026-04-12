import { useState, useRef, useEffect } from "react";
import { Camera, Check, ImageOff, Upload, Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const stockImages = [
  "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_27r1gi27r1gi27r1.webp",
  "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_4ll7zb4ll7zb4ll7.webp",
  "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_5ghzlf5ghzlf5ghz.webp",
  "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_9n12qp9n12qp9n12.webp",
  "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_eqcj45eqcj45eqcj.webp",
  "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_f80qx3f80qx3f80q.webp",
  "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_kllgvtkllgvtkllg.webp",
  "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_n21j4cn21j4cn21j.webp",
  "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_u7hwvvu7hwvvu7hw.webp",
  "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_vsqc04vsqc04vsqc.webp",
];

export { stockImages };

interface CoverPhotoUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export default function CoverPhotoUpload({ value, onChange }: CoverPhotoUploadProps) {
  const [isGalleryExpanded, setIsGalleryExpanded] = useState(!value);
  const [isUploading, setIsUploading] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [galleryHeight, setGalleryHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (galleryRef.current) {
      setGalleryHeight(galleryRef.current.scrollHeight);
    }
  }, [isGalleryExpanded]);

  const handleSelect = (url: string | null) => {
    onChange(url);
    if (url) {
      setIsGalleryExpanded(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop() || "webp";
      const fileName = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error } = await supabase.storage
        .from("event-covers")
        .upload(fileName, file, { contentType: file.type, upsert: false });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("event-covers")
        .getPublicUrl(fileName);

      onChange(urlData.publicUrl);
      setIsGalleryExpanded(false);
      toast.success("Cover image uploaded!");
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Failed to upload image");
    } finally {
      setIsUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label className="block">Cover Image</Label>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Preview with Change Cover overlay */}
      {value ? (
        <button
          type="button"
          onClick={() => setIsGalleryExpanded((v) => !v)}
          className="relative w-full rounded-lg overflow-hidden border border-border group focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <img
            src={value}
            alt="Selected cover"
            className="w-full h-32 object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <span className="flex items-center gap-1.5 text-sm font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full px-3 py-1.5">
              <Camera className="h-3.5 w-3.5" />
              Change Cover
            </span>
          </div>
          <div className="absolute bottom-2 right-2 bg-black/50 rounded-full p-1.5 group-hover:hidden">
            <Camera className="h-3.5 w-3.5 text-white" />
          </div>
        </button>
      ) : (
        !isGalleryExpanded && (
          <button
            type="button"
            onClick={() => setIsGalleryExpanded(true)}
            className="w-full h-32 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            <Camera className="h-5 w-5" />
            <span className="text-sm font-medium">Add Cover Image</span>
          </button>
        )
      )}

      {/* Animated expandable thumbnail carousel */}
      <div
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: isGalleryExpanded ? (galleryHeight ?? 200) : 0,
          opacity: isGalleryExpanded ? 1 : 0,
        }}
      >
        <div ref={galleryRef} className="flex overflow-x-auto gap-3 pt-1 pb-2 scrollbar-thin">
          {/* Upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-1 transition-all duration-150 disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            ) : (
              <>
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="text-[10px] font-medium text-muted-foreground">Upload</span>
              </>
            )}
          </button>

          {/* No Cover option */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-150 flex flex-col items-center justify-center gap-1 ${
              value === null
                ? "border-primary ring-2 ring-primary/40 scale-105 bg-primary/5"
                : "border-border hover:border-primary/50 bg-muted/50"
            }`}
          >
            <ImageOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">No Cover</span>
          </button>

          {stockImages.map((url) => {
            const isSelected = value === url;
            return (
              <button
                key={url}
                type="button"
                onClick={() => handleSelect(url)}
                className={`relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-all duration-150 ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/40 scale-105"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <img
                  src={url}
                  alt="Cover option"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="bg-primary text-primary-foreground rounded-full p-0.5">
                      <Check className="h-3 w-3" />
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
