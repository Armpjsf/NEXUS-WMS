import { FlaskConical } from 'lucide-react';

// Marks a module whose data is simulated / not yet wired to real hardware or a
// real carrier API, so nobody mistakes it for production output.
export function ExperimentalBanner({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#facc15]/40 bg-[#facc15]/10 px-4 py-3 text-sm text-[#facc15]">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <span className="mr-2 rounded-md bg-[#facc15] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1b1600]">ทดลอง</span>
        {children}
      </div>
    </div>
  );
}

export function ExperimentalPill() {
  return (
    <span className="ml-auto shrink-0 rounded bg-[#facc15]/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-[#facc15]">
      ทดลอง
    </span>
  );
}
