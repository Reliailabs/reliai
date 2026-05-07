type SystemPageHeaderProps = {
  title: string;
  description: string;
};

export function SystemPageHeader({ title, description }: SystemPageHeaderProps) {
  return (
    <header className="space-y-2">
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">System Admin</p>
      <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
      <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
    </header>
  );
}
