import { redirect } from "next/navigation";

import { resolveSignupHref } from "@/lib/signup-link";

export default function SignupShimPage() {
  redirect(resolveSignupHref());
}
