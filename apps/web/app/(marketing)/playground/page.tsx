import { PlaygroundExperience } from "@/components/playground/playground-experience";

interface PlaygroundPageProps {
  searchParams?: Promise<{ visual?: string }>;
}

export default async function PlaygroundPage({ searchParams }: PlaygroundPageProps) {
  const params = await searchParams;
  const visualTestMode = params?.visual === "1";
  return (
    <div data-playground-container="" data-playground-container-ready={visualTestMode ? "" : undefined}>
      <PlaygroundExperience disableAnimation={visualTestMode} />
    </div>
  );
}
