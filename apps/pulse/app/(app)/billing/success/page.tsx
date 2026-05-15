import { redirect } from "next/navigation";

export default function BillingSuccessShimPage() {
  redirect("/settings");
}
