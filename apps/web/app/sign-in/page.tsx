import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-6">
      <Card className="w-full max-w-md p-8">
        <p className="text-xs uppercase tracking-[0.24em] text-steel">Operator access</p>
        <h1 className="mt-3 text-2xl font-semibold">Sign-in shell</h1>
        <p className="mt-3 text-sm leading-6 text-steel">
          Authentication is intentionally stubbed for Milestone 1. Use this shell to move through
          onboarding and verify page routing.
        </p>
        <div className="mt-6 flex gap-3">
          <Button asChild>
            <Link href="/dashboard">Continue to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/onboarding">Setup flow</Link>
          </Button>
        </div>
      </Card>
    </main>
  );
}
