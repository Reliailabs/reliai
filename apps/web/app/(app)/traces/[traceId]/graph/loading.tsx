function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-2xl bg-zinc-200/70 ${className}`} />;
}

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="rounded-[30px] border border-zinc-300 bg-white p-6 shadow-sm">
        <PulseBlock className="h-4 w-24" />
        <PulseBlock className="mt-4 h-10 w-72" />
        <PulseBlock className="mt-3 h-5 w-[32rem] max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <PulseBlock className="h-72 w-full" />
        <PulseBlock className="h-72 w-full" />
      </div>
      <PulseBlock className="h-[44rem] w-full" />
    </div>
  );
}
