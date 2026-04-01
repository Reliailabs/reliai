import Link from "next/link";

interface DocsLinkProps {
  href: string;
  label: string;
  /** "dark" for dark-bg surfaces (AI cards, modals). "light" for light-bg surfaces (limit banners, light cards). */
  variant?: "dark" | "light";
}

/**
 * Contextual docs link for in-product surfaces.
 * Opens in a new tab so operators don't lose their place.
 */
export function DocsLink({ href, label, variant = "light" }: DocsLinkProps) {
  const cls =
    variant === "dark"
      ? "text-zinc-400 hover:text-zinc-200"
      : "text-zinc-400 hover:text-zinc-600";

  return (
    <Link
      href={href as never}
      target="_blank"
      rel="noopener noreferrer"
      className={`text-xs underline-offset-4 hover:underline transition-colors ${cls}`}
    >
      {label}
    </Link>
  );
}
