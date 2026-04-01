import type { MDXComponents } from "mdx/types";

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h1: ({ children }) => (
      <h1 className="text-3xl font-semibold tracking-tight text-textPrimary mb-[32px]">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold text-textPrimary mt-[40px] mb-[16px]">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-base font-semibold text-textPrimary mt-[24px] mb-[8px]">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="text-sm leading-7 text-textSecondary mb-[16px]">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="space-y-[6px] mb-[16px] ml-[16px]">{children}</ul>
    ),
    li: ({ children }) => (
      <li className="flex items-start gap-[8px] text-sm text-textSecondary">
        <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-textMuted" />
        <span>{children}</span>
      </li>
    ),
    hr: () => <hr className="border-border my-[32px]" />,
    strong: ({ children }) => (
      <strong className="font-semibold text-textPrimary">{children}</strong>
    ),
    code: ({ children }) => (
      <code className="rounded bg-surface px-[6px] py-[2px] font-mono text-xs text-textSecondary">
        {children}
      </code>
    ),
    ...components,
  };
}
