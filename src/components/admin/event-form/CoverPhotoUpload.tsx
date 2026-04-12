import { useState } from "react";
import { Camera, Check } from "lucide-react";
import { Label } from "@/components/ui/label";

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

  const handleSelect = (url: string) => {
    onChange(url);
    setIsGalleryExpanded(false);
  };

  return (
    <div className="space-y-2">
      <Label className="block">Cover Image</Label>

      {/* Preview with Change Cover overlay */}
      {value && (
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
          {/* Always-visible hint on mobile */}
          <div className="absolute bottom-2 right-2 bg-black/50 rounded-full p-1.5 group-hover:hidden">
            <Camera className="h-3.5 w-3.5 text-white" />
          </div>
        </button>
      )}

      {/* Expandable thumbnail carousel */}
      {isGalleryExpanded && (
        <div className="flex overflow-x-auto gap-3 mt-1 pb-2 scrollbar-thin">
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
      )}
    </div>
  );
}
