import { SystemLayoutShell } from "./system-layout-shell";

type SystemStubProps = {
  title: string;
  description: string;
};

export function SystemStub({ title, description }: SystemStubProps) {
  return (
    <SystemLayoutShell title={title} description={description} />
  );
}
