import { redirect } from "next/navigation";

export default async function RegressionCompareShimPage({
  params,
}: {
  params: Promise<{ regressionId: string }>;
}) {
  const { regressionId } = await params;
  redirect(`/operations/regressions/${regressionId}`);
}
