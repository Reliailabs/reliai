import { DemoExperience } from "@/components/demo/demo-experience";

interface DemoPageProps {
  searchParams?: Promise<{ visual?: string }>;
}

export default async function DemoPage({ searchParams }: DemoPageProps) {
  const params = await searchParams;
  const visualTestMode = params?.visual === "1";
  return (
    <div data-demo-container="" data-demo-container-ready={visualTestMode ? "" : undefined}>
      <DemoExperience visualTestMode={visualTestMode} />
    </div>
  );
}
