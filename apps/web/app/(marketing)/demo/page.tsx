import { DemoExperience } from "@/components/demo/demo-experience";

interface DemoPageProps {
  searchParams?: Promise<{ visual?: string }>;
}

export default async function DemoPage({ searchParams }: DemoPageProps) {
  const params = await searchParams;
  return <DemoExperience visualTestMode={params?.visual === "1"} />;
}
