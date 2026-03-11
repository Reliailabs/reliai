function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-zinc-200/70 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-zinc-300 bg-white p-6 shadow-sm">
        <PulseBlock className="h-4 w-28" />
        <PulseBlock className="mt-4 h-10 w-96 max-w-full" />
        <PulseBlock className="mt-3 h-5 w-72" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <PulseBlock className="h-[34rem] w-full" />
        <PulseBlock className="h-[34rem] w-full" />
      </div>
    </div>
  );
}
