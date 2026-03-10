Read AGENTS.md and docs/02-full-technical-build-spec.md.

Run a full QA pass on the Reliai codebase.

Tasks:

1. Identify broken or risky code paths
2. Check schema vs model mismatches
3. Detect dead code
4. Detect missing tests
5. Identify API inconsistencies
6. Validate tenant isolation
7. Validate compare endpoints
8. Validate incident lifecycle

Also review:

- migrations
- service layer logic
- API contracts
- frontend API client usage

Constraints:

- avoid AI slop
- prefer explicit issues with file paths
- do not refactor large areas unless necessary

Return:

1. QA findings
2. risky areas
3. missing tests
4. recommended fixes
5. prioritized bug list
