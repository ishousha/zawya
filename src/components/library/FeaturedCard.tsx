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
      className="flex-none w-36 sm:w-40 md:w-44 lg:w-48 snap-start text-left group"
    >
      <div className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border border-gold/15 bg-card transition-transform group-active:scale-[0.98]">
        <ResourceCover
          res={resource}
          speakerImage={speakerImage}
          eventCover={eventCover}
          Icon={Icon}
          label={label}
          rounded=""
          showLabel={false}
        />
        <div className="absolute top-2 left-2 flex items-center gap-1 bg-card/95 backdrop-blur-sm pl-1.5 pr-2 h-5 rounded-full border border-gold/30 shadow-sm">
          <Icon className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-foreground uppercase tracking-wide leading-none">
            {label}
          </span>
        </div>
      </div>
      <h3 className="mt-2 px-0.5 font-heading text-sm font-semibold text-foreground leading-snug line-clamp-2">
        {resource.title}
      </h3>
    </button>
  );
}

const FeaturedCard = memo(FeaturedCardImpl);
export default FeaturedCard;
