type EmptyStateNoticeProps = {
  message: string;
};

export function EmptyStateNotice({ message }: EmptyStateNoticeProps) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-8 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
