# Reliai Launch Plan

---

## Pre-launch Checklist

Before pushing the public repos or posting anywhere:

- [ ] Demo runs in <60s — `docker compose up` in `reliai-demo`, data appears on dashboard within one minute
- [ ] README visual-first — screenshot is at the top on every repo-template, quickstart before any explanation
- [ ] Trust strip (badges) present on all repo-template READMEs
- [ ] Screenshots show an active, non-empty system — incident open, trace graph populated, guardrail retry visible
- [ ] `python scripts/weekly_refresh.py` runs clean with no errors
- [ ] `python scripts/weekly_broadcast.py --dry-run` prints a valid tweet ≤280 chars
- [ ] GitHub Actions workflows (`qa.yml`, `weekly_activity.yml`) pass on a test branch
- [ ] `repo-templates/reliai-demo/assets/` contains `control-panel.png` and `incident.png`
- [ ] All repo-templates have an `assets/` folder with local screenshots (no broken image links)
- [ ] `reliai-demo` docker-compose.yml references correct service image names

---

## Hacker News Launch

### Title

```
Show HN: Reliai – open-source AI reliability with trace-level debugging
```

Why: "Show HN" is the correct format. "open-source" increases clicks. "trace-level debugging" is concrete and verifiable.

### First comment (post immediately after submission)

```
Hi HN — I built Reliai to debug failures in AI systems (RAG, agents, tool use) at the trace level.

Most AI tools show logs or metrics, but when something breaks (hallucination, bad retrieval,
tool failure), it's hard to see why.

Reliai shows a full trace of what happened:

- retriever → what context was fetched
- LLM → what prompt + response
- tools → what executed + latency
- guardrails → when retries or blocks happened

You can run everything locally in about a minute:

    docker compose up

It spins up a control panel, synthetic AI traffic (RAG + agents), and realistic failures
(hallucinations, retries, tool timeouts) — so the dashboard is immediately "alive" instead
of empty.

A couple things I'm especially interested in feedback on:

1. Does the trace view actually help you understand failures faster?
2. What's missing when debugging your own AI systems today?
3. Is the local demo useful, or would you expect a hosted version first?

Happy to answer anything — would love honest feedback.
```

### Backup comment (post ~30–60 min later if thread is growing)

```
One thing that surprised me while building this: most failures weren't model issues — they were:

- bad retrieval context
- tool timeouts
- retry loops

That's why the trace view focuses on the full chain instead of just the LLM output.
```

### Preloaded Q&A

**"How is this different from OpenTelemetry?"**

> OpenTelemetry gives you spans, but not AI-specific context. Reliai is focused on prompts,
> responses, retrieval, and guardrails — so you can debug AI failures directly, not just
> request traces.

**"Why not just logs?"**

> Logs don't show the full chain of decisions. For example: retriever → LLM → tool → retry.
> Reliai shows that as one trace instead of separate log lines you have to correlate manually.

**"Does it work with LangChain / LlamaIndex / etc.?"**

> Yes — the SDK auto-instruments common AI frameworks, so you get traces without adding a lot
> of code. See `reliai-examples/` for working integrations.

**"What about cost / self-hosting?"**

> The platform is fully self-hosted. `docker compose up` runs the whole stack locally.
> There's no SaaS dependency for the core functionality.

### Timing

Best: **8–10 AM PST, Tuesday–Thursday**

The `weekly_activity.yml` cron runs Tuesday at 15:00 UTC (8 AM PST) — coordinate the HN post with the automated commit so the repo shows activity the same day.

### Success signals

| Timeframe | Upvotes | Signal |
|---|---|---|
| 2 hours | 10–20 | Healthy |
| 2 hours | 30–50 | Trending likely |
| 2 hours | <5 | Re-post or adjust title |

---

## Twitter/X Launch Thread

Post within ±15 minutes of the HN submission. After posting Tweet 5, self-reply with the HN link.

### Tweet 1 (hook)

```
We built a way to actually debug AI failures.

Not logs. Not metrics.

Full traces of what happened:

• retrieval
• LLM calls
• tools
• guardrails

You can run it locally in 60 seconds ↓
```

### Tweet 2 (show the system)

```
When something breaks, you see the entire chain:

retriever → context
LLM → prompt + response
tool → execution + latency
guardrail → retry/block

Instead of guessing, you can see exactly where it failed.
```

### Tweet 3 (demo + credibility)

```
We made a demo that doesn't look empty.

It generates:

• hallucinations (~8%)
• retrieval failures (~2%)
• tool timeouts (~1.5%)

So the dashboard is already "alive" when you open it.
```

### Tweet 4 (call to action)

```
Run it locally:

git clone https://github.com/reliai/reliai-demo
cd reliai-demo
docker compose up

→ http://localhost:3000

Takes ~60 seconds.
```

### Tweet 5 (HN + engagement driver)

```
Also just posted this on Hacker News — would love honest feedback:

What's the hardest part of debugging AI systems today?

(HN link in replies)
```

### First reply (add after the thread)

```
Example trace of a failure:

retriever pulled low-quality context
LLM hallucinated
guardrail triggered retry

This is the kind of thing we wanted to make visible.
```

---

## Launch Day Checklist

On the day of launch (8–10 AM PST, Tuesday preferred):

- [ ] Post Twitter/X thread
- [ ] Submit Hacker News title + first comment
- [ ] Self-reply on Tweet 5 with HN link
- [ ] Post on Reddit — r/MachineLearning or r/LocalLLaMA (link post with the demo repo)
- [ ] Reply to HN first comment within 5 minutes of submission going live
- [ ] Notify any beta contacts or early users
- [ ] Watch GitHub star count at 2h, 6h, 24h, 48h
- [ ] Respond actively to all HN comments in the first 2 hours (ranking depends on this)

---

## Metrics to Track

| Metric | Tool | When to check |
|---|---|---|
| GitHub stars | github.com/reliai/reliai → Insights | 2h, 24h, 48h, 7d |
| Clones | GitHub → Traffic → Clones | daily |
| Issues opened | GitHub → Issues | daily — each issue = signal of real adoption |
| HN score + comment count | news.ycombinator.com | every 30 min on launch day |
| Tweet impressions | Twitter/X analytics | 24h post |
| Tweet link clicks | Twitter/X analytics | 24h post |

---

## Post-launch Actions

**First 2 hours (most important):**
- Reply to every HN comment — questions, criticism, and encouragement equally
- Fix any onboarding failures immediately (docker errors, broken demo, missing deps)
- Add clarifications to the HN first comment if a recurring question emerges

**Day 1–2:**
- Convert useful feedback from HN/Twitter comments into GitHub issues
- If the thread stays active: post the backup comment (the "most failures weren't model issues" one)
- Optional follow-up post on Day 2–3: `Show HN: Reliai demo – reproducible AI failures (RAG + agents)`

**Week 1:**
- Close or triage all new issues
- Update `## What's New` in README with anything that actually changed based on feedback
- Post one follow-up tweet summarizing what you learned from launch day comments

---

## Weekly Growth Loop (After Launch)

The automated weekly workflow handles most of this:

| Task | Automation | Manual |
|---|---|---|
| Update `## What's New` in all READMEs | `weekly_activity.yml` → `weekly_refresh.py` | Add real product changes to the message pool |
| Rotate `## Featured Example` | `weekly_activity.yml` → `weekly_refresh.py` | — |
| Regenerate marketing screenshots | `weekly_activity.yml` → `screenshot-refresh` job | — |
| Post to Twitter/X | `weekly_activity.yml` → `broadcast` job | Add `TWITTER_API_KEY` etc. to GitHub Secrets |
| Create weekly GitHub release | `weekly_activity.yml` → `release` job | — |
| Respond to new issues / stars | — | Every Tuesday |

**To update the message pool with real changes:**

Edit `MESSAGES` in `scripts/weekly_refresh.py` — add the actual update at the next free slot. The rotation is keyed by ISO week number % len(MESSAGES), so adding entries at the end doesn't break existing rotation.

---

## Day +1 Follow-Up Tweet

Post ~24 hours after the original thread, in the same time window. Insight-driven — adds new signal rather than repeating the pitch.

```
Spent the last 24 hours reading feedback on Reliai (AI trace debugging).

Big takeaway:

Most failures aren't model issues — they're:
• bad retrieval
• tool timeouts
• retry loops

That's why we focused on full trace visibility instead of just LLM outputs.

If you missed it: https://github.com/reliai/reliai-demo
```

**Optional reply (add immediately after):**

```
One example we saw:

retriever → low-quality context
LLM → confident but wrong answer
guardrail → retry with corrected prompt

Without a trace, this just looks like "the model messed up."
```

**Alternate version (use if HN post trended):**

```
Reliai ended up on the HN front page yesterday.

Most interesting feedback:

Debugging AI isn't about "better models" — it's about seeing the full chain:

retrieval → LLM → tools → retries

That's what we tried to make visible.

Demo (runs locally): https://github.com/reliai/reliai-demo
```

**After posting:** Reply to every thoughtful comment. Ask one follow-up question: *"What's the hardest failure you've tried to debug recently?"* — this often sparks strong threads.

---

## Reddit Posts (Day 3)

Post to r/MachineLearning first, then r/programming 30–60 minutes later. Morning US time.

### r/MachineLearning

**Title:**
```
[D] Debugging AI systems is mostly about retrieval/tool failures, not models — built a trace-based tool to explore this
```

**Post body:**
```
I've been working on a small open-source tool called Reliai to debug failures in AI systems
(RAG, agents, tool use), and something interesting came up while building it:

Most failures aren't actually model issues.

They're usually:
- low-quality retrieval context
- tool execution failures or timeouts
- retry loops caused by guardrails

But most tooling today focuses on model outputs, eval scores, and logs — which makes it hard
to understand *why* a system failed.

So I built a trace-based view that shows the full chain:

retriever → context
LLM → prompt + response
tool → execution + latency
guardrail → retry/block

The goal is to debug the system behavior, not just the model.

There's also a local demo (docker compose) that generates:
- hallucinations (~5%)
- retrieval failures (~2%)
- tool timeouts (~1%)

so the dashboard isn't empty when you start it.

Curious if this matches what others are seeing:
- Are most of your failures model-related, or system-related?
- How are you debugging multi-step AI pipelines today?

Repo: https://github.com/reliai/reliai-demo
```

### r/programming

**Title:**
```
Show r/programming: Open-source tool to trace and debug AI pipelines locally (RAG, agents, tools)
```

**Post body:**
```
I built an open-source tool to help debug AI systems (RAG apps, agents, tool pipelines) by
showing full execution traces instead of just logs.

When something breaks, you can see:

retriever → what context was fetched
LLM → prompt + response
tool → what ran + latency
guardrail → retries or blocks

Instead of guessing from logs, you can see the entire chain in one place.

There's also a local demo you can run:

    git clone https://github.com/reliai/reliai-demo
    cd reliai-demo
    docker compose up
    → http://localhost:3000

It generates realistic traffic (hallucinations, retries, tool failures), so the dashboard is
already populated.

Would love feedback on:
- whether this would actually help in your workflow
- what's missing when debugging AI apps today

Repo: https://github.com/reliai/reliai-demo
```

**First comment (add to either post if the thread needs a boost):**

```
One thing that surprised me:

When you actually see the trace, a lot of "model errors" turn out to be:
- bad context from retrieval
- tool failures upstream
- retry loops

The model is often doing exactly what it was given.
```

---

## Preloaded Q&A Replies

Drop these when the relevant comments appear. Respond fast — first 10–20 minutes matters most for ranking. Don't dump them all at once; wait for the real comments.

**"How is this different from OpenTelemetry / Datadog?"**

```
Good question — those tools give you spans/metrics, but not AI-specific context.

What we kept running into: you'd see a slow request, but not *why*.

Reliai focuses on the AI chain itself:
- what context retrieval returned
- the exact prompt/response
- tool execution + latency
- guardrail retries

So instead of "this request was slow," you get: "retrieval returned low-quality context →
model hallucinated → guardrail retried."

It's more about debugging behavior than infrastructure.
```

**"Why not just use logs?"**

```
Logs tell you *what happened*, but not how everything connects.

In most AI apps, a single user request turns into:
retrieval → LLM → tool → retry → final response

Those usually show up as separate log lines.

The trace just stitches that into one view so you can follow the chain end-to-end.

That ended up being the biggest difference for us when debugging issues.
```

**"Does this work with LangChain / FastAPI / X?"**

```
Yep — the SDK auto-instruments common frameworks, so you don't have to manually wrap
everything.

For example:
- FastAPI → request traces automatically
- LangChain → chain + tool execution
- OpenAI → LLM calls

You can also run apps with:

    reliai-run python app.py

which instruments everything without changing your code.

Still early, but trying to make it as close to zero-config as possible.
```

**"Is this just another AI observability tool?"**

```
Totally fair question.

The difference we focused on is *what level you debug at*.

A lot of tools focus on evals, outputs, aggregate metrics.

This is more about: "what exactly happened in this one failure?" So you can inspect:
- the actual retrieved context
- the exact prompt that was sent
- where the chain broke

It's closer to a debugger than a dashboard.
```

**"Can I run this locally / is it SaaS-only?"**

```
You can run everything locally — that was a big goal.

The demo repo is:

    docker compose up

and it spins up the control panel, synthetic AI traffic, and some built-in failure cases.

So you can poke around immediately without wiring it into your own app first.

There's a hosted version planned, but local-first felt important for dev workflows.
```

**Bonus (drop ~30–60 min in if discussion is going well):**

```
One unexpected thing while building this:

We kept assuming "the model is the problem," but most issues were upstream:
- bad retrieval
- missing context
- tool failures

Seeing the full trace made that really obvious.
```

---

## Handling Hostile Comments

These responses follow one pattern: **agree or validate → narrow the claim → explain calmly → never win the argument.** Tone is always neutral and technical.

Never say: "you're wrong", "you don't understand", "this is better than X", "actually…"

---

**"This is just another AI observability tool"**

```
Yeah that's fair — there are definitely a lot of tools in this space right now.

The main thing we kept running into was that most tools focus on outputs or metrics, but when
something breaks, it's hard to see the full chain.

We wanted something closer to: "what exactly happened in this one failure?"

That's why the trace view is centered on: retrieval → LLM → tools → retries

But totally agree the space is getting crowded.
```

---

**"You don't need this, just use logs"**

```
Totally — logs can get you pretty far.

The issue we hit was that a single request often turns into multiple steps:
retrieval → LLM → tool → retry

Those show up as separate logs, which makes it hard to follow the flow.

The trace just connects those steps into one timeline.

If your current logging setup already gives you that visibility, this probably isn't as useful.
```

---

**"This feels like overkill / unnecessary complexity"**

```
That's fair — for simpler setups this is probably overkill.

Where it started to help for us was when things became multi-step:
- RAG pipelines
- tool calls
- retries/guardrails

At that point it got harder to reason about failures from logs alone.

If you're not hitting that complexity yet, I wouldn't expect this to add much value.
```

---

**"Why not just use OpenTelemetry?"**

```
OpenTelemetry is great — this actually builds on a similar idea (spans/traces).

The gap we were trying to fill is AI-specific context:
- prompt + response
- retrieved documents
- tool inputs/outputs
- guardrail behavior

With raw traces you still have to add all of that manually.

This is more opinionated around AI workflows specifically.
```

---

**"This won't scale / looks like a toy demo"**

```
Yeah the demo is intentionally small — it's just there so people can see something working
immediately.

The underlying idea is the same at larger scale: each request → one trace with all steps
attached.

Totally fair point though — production scale is where this kind of tool actually needs to
prove itself.
```

---

**Power move (use for especially critical but thoughtful comments):**

```
This is helpful — I think you're pointing at something real here.

Curious: how are you debugging these issues today?

Trying to understand where this actually breaks down in practice.
```

This often turns critics into contributors, extends the thread, and increases visibility.

---

## Tone Rules

Apply to all replies across HN, Twitter, and Reddit:

| Always | Never |
|---|---|
| Neutral | "you're wrong" |
| Technical | "you don't understand" |
| Non-defensive | "this is better than X" |
| Validate first | "actually…" |
| Qualify down, not up | "revolutionary" |

The most credible position is being willing to say: *"This might not be useful for you."* That's what makes people lean in.
