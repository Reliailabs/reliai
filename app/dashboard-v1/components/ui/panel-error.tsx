export function PanelError({ detail }: { detail?: string }) {
  return (
    <div className="rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-3">
      <p className="text-sm text-amber-200">Unable to load this panel.</p>
      {detail ? <p className="mt-1 text-xs text-amber-300/90">{detail}</p> : null}
    </div>
  );
}
