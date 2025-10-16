import React from 'react';

type Props = {
  width: number;
  height: number;

  /** Main fill color (back color). Example: '#4338ca' (indigo-600) */
  fillColor?: string;

  /** Band around the dots area (the ring *inside* the outer rim). Example: '#0f172a' (slate-900) */
  bandColor?: string;

  /** Outer rim color (the card’s main border). If omitted, uses a darker fillColor. */
  rimColor?: string;

  /** Optional center label */
  label?: string;

  /** Extra class/style passthroughs */
  className?: string;
  style?: React.CSSProperties;
};

export const CardBack: React.FC<Props> = ({
  width,
  height,
  fillColor = '#4338ca',  // indigo-600
  bandColor = '#0f172a',  // slate-900
  rimColor,
  label = 'DURAK',
  className = '',
  style,
}) => {
  // ---- Sizing tuned to feel like a real card ----
  const radius = Math.round(height * 0.08);             // ~8% height corner radius
  const edgePx = Math.max(2, Math.round(height * 0.02)); // white edge thickness
  const bandOuterInset = edgePx + 2;                     // where the band starts
  const innerBorderInset = bandOuterInset + Math.max(6, Math.round(height * 0.025));
  const dotsInset = innerBorderInset + 3;

  const innerRadius = Math.max(6, radius - bandOuterInset);
  const borderRadiusInner = Math.max(4, radius - innerBorderInset + 1);
  const borderRadiusDots = Math.max(3, radius - dotsInset + 2);

  // Fallback rim color if not provided: a darker version of fillColor via overlay trick
  const outerRimColor = rimColor ?? 'rgba(0,0,0,0.35)';

  return (
    <div
      className={`relative select-none shadow-lg ${className}`}
      style={{
        width,
        height,
        borderRadius: radius,
        // Drop shadow like a real card on table
        boxShadow: `
          0 8px 14px rgba(0,0,0,0.24),
          0 3px 6px rgba(0,0,0,0.18)
        `,
        ...style,
      }}
      aria-label="Card back"
      draggable={false}
    >
      {/* Base fill (main back color) + subtle diagonal highlight */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          background: `
            linear-gradient(135deg, ${fillColor} 0%, ${fillColor} 55%),
            linear-gradient(120deg, rgba(255,255,255,0.12), rgba(255,255,255,0) 45%)
          `,
        }}
      />

      {/* White paper edge + outer rim (bevel) */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          // Two inner strokes: paper edge (white) + a darker rim to separate from table
          boxShadow: `
            inset 0 0 0 ${edgePx}px #ffffff,
            inset 0 0 0 ${edgePx + 1}px ${outerRimColor},
            inset 0 2px 6px rgba(0,0,0,0.18),    /* top bevel */
            inset 0 -2px 6px rgba(255,255,255,0.08) /* bottom sheen */
          `,
          pointerEvents: 'none',
        }}
      />

      {/* BAND (inside the rim, around the dots) */}
      <div
        className="absolute"
        style={{
          left: bandOuterInset, top: bandOuterInset,
          right: bandOuterInset, bottom: bandOuterInset,
          borderRadius: innerRadius,
          background: bandColor,
          opacity: 0.75,
        }}
      />

      {/* Inner inset border hugging the dots area (same family as bandColor) */}
      <div
        className="absolute"
        style={{
          left: innerBorderInset, top: innerBorderInset,
          right: innerBorderInset, bottom: innerBorderInset,
          borderRadius: borderRadiusInner,
          boxShadow: `inset 0 0 0 1.25px ${bandColor}99`, // 60% alpha
        }}
      />

      {/* Dots area (you said dots are fine — preserved) */}
      <div
        className="absolute"
        style={{
          left: dotsInset, top: dotsInset,
          right: dotsInset, bottom: dotsInset,
          borderRadius: borderRadiusDots,
          opacity: 0.28,
          backgroundImage:
            'radial-gradient(circle at 10px 10px, rgba(255,255,255,0.35) 2px, transparent 2px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Subtle paper noise over everything (for realism) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: radius,
          backgroundImage: `
            radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
            linear-gradient(rgba(0,0,0,0.06), rgba(0,0,0,0.06))
          `,
          backgroundSize: '2px 2px, 100% 100%',
          mixBlendMode: 'overlay',
        }}
      />

      {/* Specular gloss strip (laminate look) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: radius,
          background:
            'linear-gradient(75deg, rgba(255,255,255,0.14) 8%, rgba(255,255,255,0.02) 18%, rgba(255,255,255,0) 35%)',
          transform: 'translateY(-3%)',
        }}
      />

      {/* Center label (small, not too loud) */}
      <div className="absolute inset-0 grid place-items-center">
        <span
          className="font-extrabold tracking-widest select-none"
          style={{
            color: 'rgba(255,255,255,0.9)',
            textShadow: '0 1px 2px rgba(0,0,0,0.35)',
            fontSize: Math.max(10, Math.round(height * 0.085)),
            letterSpacing: Math.max(1, Math.round(width * 0.015)),
          }}
        >
          {label}
        </span>
      </div>
    </div>
  );
};