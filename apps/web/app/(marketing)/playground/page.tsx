import { PlaygroundExperience } from "@/components/playground/playground-experience";

interface PlaygroundPageProps {
  searchParams?: Promise<{ visual?: string }>;
}

export default async function PlaygroundPage({ searchParams }: PlaygroundPageProps) {
  const params = await searchParams;
  return <PlaygroundExperience disableAnimation={params?.visual === "1"} />;
}
