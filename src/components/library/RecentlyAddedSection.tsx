import { memo } from "react";
import type { FileText } from "lucide-react";
import FeaturedCarousel from "./FeaturedCarousel";
import FeaturedCard from "./FeaturedCard";

type Resource = {
  id: string;
  title: string;
  cover_image_url?: string | null;
  event_id?: string | null;
  speaker_ids?: string[] | null;
  resource_type?: string;
  category?: string;
  tags?: string[] | null;
};

type SpeakerLite = { id: string; name: string; image_url?: string | null };
type EventLite = { id: string; title: string; date_time: string; cover_photo_url?: string | null };

type Props = {
  resources: Resource[];
  speakerById: Map<string, SpeakerLite>;
  eventById: Map<string, EventLite>;
  getResourceMeta: (r: Resource) => { Icon: typeof FileText; label: string };
  onSelect: (res: Resource) => void;
};

function RecentlyAddedSectionImpl({ resources, speakerById, eventById, getResourceMeta, onSelect }: Props) {
  if (resources.length === 0) return null;
  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Recently Added
          </h2>
          <div className="mt-1 flex items-center gap-1 text-gold/70" aria-hidden>
            <span className="text-[8px]">◆</span>
            <span className="text-[6px]">◆</span>
            <span className="text-[8px]">◆</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {resources.length} new
        </span>
      </div>
      <FeaturedCarousel>
        {resources.map((res) => {
          const { Icon, label } = getResourceMeta(res);
          const linkedEvent = res.event_id ? eventById.get(res.event_id) : null;
          const firstSpeaker = (res.speaker_ids ?? [])
            .map((id) => speakerById.get(id))
            .find(Boolean);
          return (
            <FeaturedCard
              key={res.id}
              resource={res}
              speakerImage={firstSpeaker?.image_url ?? null}
              eventCover={linkedEvent?.cover_photo_url ?? null}
              Icon={Icon}
              label={label}
              onSelect={onSelect}
            />
          );
        })}
      </FeaturedCarousel>
    </section>
  );
}

const RecentlyAddedSection = memo(RecentlyAddedSectionImpl);
export default RecentlyAddedSection;
