import { useRef, useState, useEffect, useCallback, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = { children: ReactNode };

export default function FeaturedCarousel({ children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateButtons = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateButtons();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", updateButtons, { passive: true });
    const ro = new ResizeObserver(updateButtons);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      ro.disconnect();
    };
  }, [updateButtons, children]);

  const scrollByAmount = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  // Pointer drag (desktop / non-touch). Touch already swipes natively.
  const drag = useRef<{ active: boolean; startX: number; startLeft: number; moved: boolean }>({
    active: false, startX: 0, startLeft: 0, moved: false,
  });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "touch") return;
    const el = ref.current;
    if (!el) return;
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft, moved: false };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const el = ref.current;
    if (!el) return;
    const dx = e.clientX - drag.current.startX;
    if (Math.abs(dx) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startLeft - dx;
  };
  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    try { ref.current?.releasePointerCapture(e.pointerId); } catch {}
  };

  return (
    <div className="relative group/carousel">
      <div
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={(e) => {
          if (drag.current.moved) {
            e.preventDefault();
            e.stopPropagation();
            drag.current.moved = false;
          }
        }}
        className="flex overflow-x-auto gap-4 pb-4 -mx-4 px-4 snap-x scrollbar-hide select-none cursor-grab active:cursor-grabbing"
      >
        {children}
      </div>

      <button
        type="button"
        aria-label="Previous"
        onClick={() => scrollByAmount(-1)}
        disabled={!canPrev}
        className={`hidden sm:flex absolute left-1 top-1/2 -translate-y-1/2 -mt-6 h-9 w-9 items-center justify-center rounded-full bg-card/95 border border-gold/30 shadow-md text-foreground backdrop-blur transition-opacity ${
          canPrev ? "opacity-90 hover:opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={() => scrollByAmount(1)}
        disabled={!canNext}
        className={`hidden sm:flex absolute right-1 top-1/2 -translate-y-1/2 -mt-6 h-9 w-9 items-center justify-center rounded-full bg-card/95 border border-gold/30 shadow-md text-foreground backdrop-blur transition-opacity ${
          canNext ? "opacity-90 hover:opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
