import { Check } from "lucide-react";
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
  return (
    <div className="space-y-3">
      {/* Live Preview */}
      {value && (
        <div className="rounded-xl overflow-hidden border border-border">
          <img
            src={value}
            alt="Selected cover"
            className="w-full h-48 object-cover"
          />
        </div>
      )}

      {/* Gallery Picker */}
      <div>
        <Label className="mb-2 block">Choose Cover Image</Label>
        <div className="grid grid-cols-5 gap-2">
          {stockImages.map((url) => {
            const isSelected = value === url;
            return (
              <button
                key={url}
                type="button"
                onClick={() => onChange(url)}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all duration-150 ${
                  isSelected
                    ? "border-primary ring-2 ring-primary/40 scale-105"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <img
                  src={url}
                  alt="Stock cover option"
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                {isSelected && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <div className="bg-primary text-primary-foreground rounded-full p-1">
                      <Check className="h-3.5 w-3.5" />
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
