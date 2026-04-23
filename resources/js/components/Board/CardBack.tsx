import React from 'react';

type Props = {
  width: number;
  height: number;

  /** Galvenā aizpildes krāsa (mugurpuses krāsa). Piem.: '#4338ca' (indigo-600) */
  fillColor?: string;

  /** Josla ap punktu laukumu (gredzens *iekš* ārējā apmales). Piem.: '#0f172a' (slate-900) */
  bandColor?: string;

  /** Ārējās apmales krāsa. Ja nav norādīts, izmanto tumšāku fillColor. */
  rimColor?: string;

  /** Izvēles centrālā etiķete */
  label?: string;

  /** Klases un stila nodošana tālāk */
  className?: string;
  style?: React.CSSProperties;
};

// Kartes mugurpuse — zīmē reālistisku karti ar gradientiem un punktu rakstu
export const CardBack: React.FC<Props> = ({
  width,
  height,
  fillColor = '#4338ca',  // indigo-600 (noklusējums)
  bandColor = '#0f172a',  // slate-900 (noklusējums)
  rimColor,
  label = 'DURAK',
  className = '',
  style,
}) => {
  // Izmēri pielāgoti lai izskatās pēc īstas kārtis
  const radius = Math.round(height * 0.08);             // ~8% augstuma stūra rādiuss
  const edgePx = Math.max(2, Math.round(height * 0.02)); // baltās malas biezums
  const bandOuterInset = edgePx + 2;
  const innerBorderInset = bandOuterInset + Math.max(6, Math.round(height * 0.025));
  const dotsInset = innerBorderInset + 3;

  const innerRadius = Math.max(6, radius - bandOuterInset);
  const borderRadiusInner = Math.max(4, radius - innerBorderInset + 1);
  const borderRadiusDots = Math.max(3, radius - dotsInset + 2);

  // Ja nav dotsrimColor, izmantojam puscaurspdīgu melno
  const outerRimColor = rimColor ?? 'rgba(0,0,0,0.35)';

  return (
    <div
      className={`relative select-none shadow-lg ${className}`}
      style={{
        width,
        height,
        borderRadius: radius,
        // Ēna kā īstai kārtij uz galda
        boxShadow: `
          0 8px 14px rgba(0,0,0,0.24),
          0 3px 6px rgba(0,0,0,0.18)
        `,
        ...style,
      }}
      aria-label="Card back"
      draggable={false}
    >
      {/* Pamata aizpildījums (galvenā mugurpuses krāsa) — ciets, bez caurspīdīguma */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          backgroundColor: fillColor,
        }}
      />
      {/* Smalks diagonāls apgaismojums */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: radius,
          backgroundImage: `linear-gradient(120deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 45%)`,
        }}
      />

      {/* Baltā papīra mala + ārējā apmale (skava) */}
      <div
        className="absolute inset-0"
        style={{
          borderRadius: radius,
          // Divi iekšējie kontūri: papīra mala (balta) + tumšāka apmale, lai atdalītu no galda
          boxShadow: `
            inset 0 0 0 ${edgePx}px #ffffff,
            inset 0 0 0 ${edgePx + 1}px ${outerRimColor},
            inset 0 2px 6px rgba(0,0,0,0.18),    /* augšējā skava */
            inset 0 -2px 6px rgba(255,255,255,0.08) /* apakšējais spīdums */
          `,
          pointerEvents: 'none',
        }}
      />

      {/* JOSLA (iekš apmales, ap punktiem) */}
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

      {/* Iekšējā robežlīnija ap punktu laukumu (tās pašas krāsas saime) */}
      <div
        className="absolute"
        style={{
          left: innerBorderInset, top: innerBorderInset,
          right: innerBorderInset, bottom: innerBorderInset,
          borderRadius: borderRadiusInner,
          boxShadow: `inset 0 0 0 1.25px ${bandColor}99`, // 60% necaurspīdīgums
        }}
      />

      {/* Punktu laukums */}
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

      {/* Smalks papīra troksnis pāri visam (reālismam) */}
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

      {/* Spīduma josla (laminēta izskata efekts) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: radius,
          background:
            'linear-gradient(75deg, rgba(255,255,255,0.14) 8%, rgba(255,255,255,0.02) 18%, rgba(255,255,255,0) 35%)',
          transform: 'translateY(-3%)',
        }}
      />

      {/* Centrālā etiķete (maza, neuzkrītoša) */}
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