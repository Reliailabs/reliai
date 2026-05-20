"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type ProjectScopeSelectorOption = {
  id: string;
  name: string;
};

export function ProjectScopeSelector({
  projects,
  selectedProjectId,
  queryKey = "project_id",
}: {
  projects: ProjectScopeSelectorOption[];
  selectedProjectId: string | null;
  queryKey?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!projects.length) return null;

  return (
    <Select
      value={selectedProjectId ?? undefined}
      onValueChange={(nextId) => {
        const params = new URLSearchParams(searchParams.toString());
        if (!nextId) {
          params.delete(queryKey);
        } else {
          params.set(queryKey, nextId);
        }
        const next = params.toString();
        router.replace(next ? `${pathname}?${next}` : pathname);
      }}
    >
      <SelectTrigger className="w-[220px] bg-transparent" aria-label="Select project scope">
        <SelectValue placeholder="Select project" />
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
