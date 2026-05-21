import { redirect } from "next/navigation";

export default async function LegacySystemCustomersProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/pulse/system/customers/${encodeURIComponent(projectId)}`);
}

