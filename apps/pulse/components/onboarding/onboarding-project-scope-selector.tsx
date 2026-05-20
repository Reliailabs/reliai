"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProjectOption = {
  id: string;
  name: string;
};

export function OnboardingProjectScopeSelector({
  projects,
  selectedProjectId,
  selectedPath,
}: {
  projects: ProjectOption[];
  selectedProjectId: string | null;
  selectedPath: "choose" | "sdk" | "simulation";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (projects.length < 2) return null;

  return (
    <Select
      value={selectedProjectId ?? undefined}
      onValueChange={(nextProjectId) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("path", selectedPath);
        params.set("project_id", nextProjectId);
        router.replace(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="h-9 w-full rounded-md border border-border px-2 text-sm text-foreground" aria-label="Select project scope">
        <SelectValue placeholder="Select project scope" />
      </SelectTrigger>
      <SelectContent>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
