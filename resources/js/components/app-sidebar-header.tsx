import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

type Props = {
  breadcrumbs?: BreadcrumbItemType[];
  side?: 'left' | 'right';
  mode?: 'overlay' | 'inset';
  openWidth?: number;
  closedWidth?: number;
  gap?: number;
  mobileGap?: number;
  topOffset?: number;
  closedEdgeOffset?: number;
  openEdgeOffset?: number;
  buttonClassName?: string;
  iconSize?: number;

  /** NEW: add/remove safe-area padding on the inline side */
  includeSafeArea?: boolean;
};

export function AppSidebarHeader({
  breadcrumbs = [],
  side = 'left',
  mode = 'inset',
  openWidth = 288,
  closedWidth = 64,
  gap = 0,  
  mobileGap = -50,              // flush by default
  topOffset = 12,
  closedEdgeOffset = 0,   // flush to rail when closed (inset)
  openEdgeOffset = 0,     // flush to drawer when open
  buttonClassName = 'px-5 py-5',
  iconSize = 22,
  includeSafeArea = false // turn off safe-area by default to be truly flush
}: Props) {
  const { open } = useSidebar?.() ?? { open: false };

  // Translate distance to “ride” the panel edge
  const base = open
    ? openWidth + openEdgeOffset
    : (mode === 'overlay' ? 0 : closedWidth) + closedEdgeOffset;

  const translateX = (side === 'left' ? 1 : -1) * base;

  // Compute inline start/end offsets (either flush or safe-area-aware)
// replace inlineStart/inlineEnd calc with this:
const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
const inlineStart = (includeSafeArea && isMobile)
  ? `calc(env(safe-area-inset-left, 0px) + ${mobileGap}px)` : `${gap}px`;
const inlineEnd = (includeSafeArea && isMobile)
  ? `calc(env(safe-area-inset-right, 0px) + ${mobileGap}px)` : `${gap}px`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 pointer-events-none" aria-label="App header">
      <SidebarTrigger
        className={[
          'pointer-events-auto fixed inline-flex items-center gap-2 rounded-full',
          'bg-black/70 hover:bg-black/85 text-white shadow-lg ring-1 ring-white/20',
          'backdrop-blur transition focus:outline-none focus-visible:ring-2',
          'focus-visible:ring-yellow-400',
          buttonClassName,
        ].join(' ')}
        style={{
          // keep top safe-area for status bar; remove it if you want fully flush at the top too
          top: `calc(env(safe-area-inset-top, 0px) + ${topOffset}px)`,
          ...(side === 'left' ? { left: inlineStart } : { right: inlineEnd }),
          transform: `translateX(${translateX}px)`,
          transition: 'transform 300ms ease',
        }}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          className="opacity-90"
        >
          <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="text-sm font-medium">Menu</span>
      </SidebarTrigger>

      <div className="sr-only">
        <Breadcrumbs breadcrumbs={breadcrumbs} />
      </div>
    </header>
  );
}