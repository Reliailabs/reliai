import { redirect } from "next/navigation";

type SearchParamsShape = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export default async function PromptVersionShimPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParamsShape>;
}) {
  const { id } = await params;
  const raw = (searchParams ? await searchParams : {}) satisfies SearchParamsShape;
  const projectId = firstParam(raw.projectId) ?? firstParam(raw.project_id);

  const query = new URLSearchParams();
  if (projectId) query.set("project_id", projectId);
  query.set("prompt_version", id);

  redirect(`/traces?${query.toString()}`);
}
