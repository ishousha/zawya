import { memo } from "react";
import type { FileText } from "lucide-react";
import { ResourceCover } from "./resourceCover";

type FeaturedResource = {
  id: string;
  title: string;
  cover_image_url?: string | null;
  event_id?: string | null;
  speaker_ids?: string[] | null;
};

type Props = {
  resource: FeaturedResource;
  speakerImage: string | null;
  eventCover: string | null;
  Icon: typeof FileText;
  label: string;
  onSelect: (res: FeaturedResource) => void;
};

function FeaturedCardImpl({ resource, speakerImage, eventCover, Icon, label, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(resource)}
      className="flex-none w-24 sm:w-28 md:w-32 lg:w-36 snap-start text-left group"
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border border-gold/15 bg-card transition-transform group-active:scale-[0.98]">
        <ResourceCover
          res={resource}
          speakerImage={speakerImage}
          eventCover={eventCover}
          Icon={Icon}
          label={label}
          rounded=""
          showLabel
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent pointer-events-none" aria-hidden />
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-card/90 backdrop-blur-sm pl-1.5 pr-2 py-0.5 rounded-full border border-gold/20">
          <Icon className="h-2.5 w-2.5 text-primary" />
          <span className="text-[9px] font-semibold text-foreground uppercase tracking-wide">
            {label}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <h3 className="font-heading text-sm font-semibold text-white leading-tight line-clamp-2 drop-shadow">
            {resource.title}
          </h3>
        </div>
      </div>
    </button>
  );
}

const FeaturedCard = memo(FeaturedCardImpl);
export default FeaturedCard;
