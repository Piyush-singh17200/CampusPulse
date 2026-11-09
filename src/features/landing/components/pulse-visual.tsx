const pillars = ["Discover with context", "Coordinate with clarity", "Learn from every event"];

const signalBars = [
  "h-[17px]",
  "h-[26px]",
  "h-[22px]",
  "h-[37px]",
  "h-[29px]",
  "h-[44px]",
  "h-[34px]",
  "h-[52px]",
  "h-[41px]",
  "h-[56px]",
  "h-[47px]",
  "h-[60px]",
];

export function PulseVisual() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-teal-400/10 blur-2xl" />

      <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
        <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          <span>Campus signal</span>
          <span className="text-teal-300">Foundation</span>
        </div>

        <div className="mt-8 space-y-3">
          {pillars.map((label, index) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3.5"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full border border-teal-400/20 bg-teal-400/10 text-xs font-semibold text-teal-200">
                0{index + 1}
              </span>
              <span className="text-sm font-medium text-slate-200">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-end gap-1.5">
          {signalBars.map((heightClass, index) => (
            <span
              key={index}
              className={`flex-1 rounded-full bg-gradient-to-t from-teal-500/20 to-teal-300/80 ${heightClass}`}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
          <span>Interest</span>
          <span>Timing</span>
          <span>Momentum</span>
        </div>
      </div>
    </div>
  );
}
