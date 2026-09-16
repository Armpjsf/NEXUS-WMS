"use client";

export const AmbientBackground = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      {/* Stitch tactical dark ground */}
      <div className="absolute inset-0 bg-[#0f141b]" />
      {/* Tactical blueprint grid */}
      <div className="absolute inset-0 opacity-[0.15] [background-image:linear-gradient(to_right,#30353d_1px,transparent_1px),linear-gradient(to_bottom,#30353d_1px,transparent_1px)] [background-size:32px_32px]" />
      {/* Subtle amber & cyan telemetry ambient glow */}
      <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(250,204,21,0.08),rgba(76,215,246,0.03),transparent)]" />
      <div className="absolute left-0 top-0 h-full w-1/4 bg-[linear-gradient(90deg,rgba(9,15,21,0.6),transparent)]" />
      <div className="absolute right-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-[#30353d] to-transparent" />
    </div>
  );
};
