import { memo } from "react";
import { FileText } from "lucide-react";

/** Deterministic 0..n-1 hash from a string. */
function hashIndex(seed: string, n: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h % n;
}

// Sufi accents — kept on-brand with the Library palette.
const TINTS = [
  { from: "hsl(var(--primary) / 0.18)",        to: "hsl(var(--parchment-deep) / 0.55)", stroke: "hsl(var(--primary) / 0.35)" }, // emerald
  { from: "hsl(var(--gold) / 0.22)",           to: "hsl(var(--parchment-deep) / 0.55)", stroke: "hsl(var(--gold) / 0.55)" },    // gold
  { from: "hsl(var(--olive) / 0.22)",          to: "hsl(var(--parchment-deep) / 0.55)", stroke: "hsl(var(--olive) / 0.45)" },   // olive
  { from: "hsl(var(--clay) / 0.22)",           to: "hsl(var(--parchment-deep) / 0.55)", stroke: "hsl(var(--clay) / 0.45)" },    // clay
];

type Props = {
  seed?: string;
  Icon: typeof FileText;
  label?: string;
  className?: string;
};

/** Themed Sufi-pattern fallback cover for resources without an image. */
function CoverFallbackImpl({ seed = "x", Icon, label, className = "" }: Props) {
  const tint = TINTS[hashIndex(seed, TINTS.length)];
  const rotation = hashIndex(seed + "r", 8) * 11; // 0..77deg
  const gradId = `cf-grad-${hashIndex(seed + "g", 9999)}`;

  return (
    <div
      className={`relative w-full h-full overflow-hidden flex items-center justify-center ${className}`}
      style={{
        background: `linear-gradient(135deg, ${tint.from} 0%, hsl(var(--parchment)) 55%, ${tint.to} 100%)`,
      }}
    >
      {/* Sufi geometric layer */}
      <svg
        viewBox="-50 -50 100 100"
        className="absolute inset-0 w-full h-full"
        aria-hidden
        style={{ transform: `rotate(${rotation}deg)` }}
      >
        <defs>
          <radialGradient id={gradId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--gold) / 0.28)" />
            <stop offset="100%" stopColor="hsl(var(--gold) / 0)" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="48" fill={`url(#${gradId})`} />
        {/* Concentric arabesque rings */}
        <circle cx="0" cy="0" r="44" fill="none" stroke={tint.stroke} strokeWidth="0.4" opacity="0.55" />
        <circle cx="0" cy="0" r="34" fill="none" stroke={tint.stroke} strokeWidth="0.35" opacity="0.45" />
        <circle cx="0" cy="0" r="24" fill="none" stroke={tint.stroke} strokeWidth="0.3" opacity="0.4" />
        {/* 8-point star (two overlapping squares) */}
        <g stroke="hsl(var(--gold) / 0.55)" strokeWidth="0.45" fill="none" opacity="0.7">
          <rect x="-22" y="-22" width="44" height="44" />
          <rect x="-22" y="-22" width="44" height="44" transform="rotate(45)" />
        </g>
        {/* Tiny radial petals */}
        <g fill="hsl(var(--gold) / 0.35)" opacity="0.7">
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i * Math.PI) / 4;
            const x = Math.cos(a) * 38;
            const y = Math.sin(a) * 38;
            return <circle key={i} cx={x} cy={y} r="0.9" />;
          })}
        </g>
      </svg>

      {/* Center emblem */}
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: "44%",
          aspectRatio: "1",
          background: "linear-gradient(140deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.06))",
          border: "1px solid hsl(var(--gold) / 0.55)",
          boxShadow: "inset 0 0 0 1px hsl(var(--card) / 0.4), 0 1px 4px hsl(var(--primary) / 0.12)",
        }}
      >
        <Icon className="text-primary" style={{ width: "44%", height: "44%" }} strokeWidth={1.75} />
      </div>

      {/* Optional baked-in type label */}
      {label && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2">
          <span className="font-heading text-[9px] uppercase tracking-[0.22em] text-primary/80">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

const CoverFallback = memo(CoverFallbackImpl);
export default CoverFallback;
