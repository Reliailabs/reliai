function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-zinc-200/70 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-zinc-300 bg-white p-6 shadow-sm">
        <PulseBlock className="h-4 w-28" />
        <PulseBlock className="mt-4 h-10 w-80" />
        <PulseBlock className="mt-3 h-5 w-[36rem] max-w-full" />
        <div className="mt-6 grid gap-4 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <PulseBlock key={index} className="h-28 w-full" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <PulseBlock className="h-[32rem] w-full" />
        <PulseBlock className="h-[32rem] w-full" />
      </div>
    </div>
  );
}
