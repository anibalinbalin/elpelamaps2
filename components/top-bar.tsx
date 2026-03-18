interface TopBarProps {
  parcelCount: number;
}

export function TopBar({ parcelCount }: TopBarProps) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent px-5 py-4">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-bold tracking-wide text-white">El Pela</span>
        <span className="text-[11px] text-white/40">José Ignacio, Uruguay</span>
      </div>
      <div className="rounded-md border border-white/12 px-3 py-1 text-[11px] text-white/50">
        {parcelCount} Parcels
      </div>
    </div>
  );
}
