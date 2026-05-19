import { redirect } from "next/navigation";

import { resolveSignupHref } from "@/lib/signup-link";

type SignupShimPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function toUrlSearchParams(searchParams: SignupShimPageProps["searchParams"]): URLSearchParams {
  const params = new URLSearchParams();
  if (!searchParams) {
    return params;
  }
  for (const [key, raw] of Object.entries(searchParams)) {
    if (raw === undefined) continue;
    if (Array.isArray(raw)) {
      for (const value of raw) {
        params.append(key, value);
      }
      continue;
    }
    params.append(key, raw);
  }
  return params;
}

export default function SignupShimPage({ searchParams }: SignupShimPageProps) {
  redirect(resolveSignupHref(toUrlSearchParams(searchParams)));
}
