import { EntrypointLink } from "@/components/entrypoints/entrypoint-link";
import { EntrypointPageViewTracker } from "@/components/entrypoints/entrypoint-page-view-tracker";
import { extractEntrypointAttribution } from "@/lib/entrypoint-analytics";
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
  const query = toUrlSearchParams(searchParams);
  const href = resolveSignupHref(query);
  const sourceAttribution = extractEntrypointAttribution(query);
  const destinationLabel = href.startsWith("http://") || href.startsWith("https://")
    ? "Reliai signup"
    : "Reliai sign-in";

  return (
    <main className="min-h-screen bg-[#09090B] text-zinc-100">
      <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16">
        <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8">
          <EntrypointPageViewTracker route="/signup" sourceAttribution={sourceAttribution} />
          <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">Reliai</p>
          <h1 className="mt-3 text-2xl font-semibold text-zinc-50">Continue to account setup</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            Signup ownership is handled through the active account entrypoint. Continue to {destinationLabel} to
            complete access.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <EntrypointLink
              href={href}
              currentRoute="/signup"
              ctaId="signup_bridge_primary_continue"
              sourceAttribution={sourceAttribution}
              className="rounded-md border border-zinc-700 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-white"
            >
              Continue
            </EntrypointLink>
            <EntrypointLink
              href="/demo"
              currentRoute="/signup"
              sourceAttribution={sourceAttribution}
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Review demo scenario
            </EntrypointLink>
            <EntrypointLink
              href="/ai-reliability-audit"
              currentRoute="/signup"
              sourceAttribution={sourceAttribution}
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Review audit path
            </EntrypointLink>
            <EntrypointLink
              href="/"
              currentRoute="/signup"
              sourceAttribution={sourceAttribution}
              className="text-sm text-zinc-400 transition-colors hover:text-zinc-200"
            >
              Back to product
            </EntrypointLink>
          </div>
          <p className="mt-4 text-xs text-zinc-500">Destination: {href}</p>
        </div>
      </div>
    </main>
  );
}
