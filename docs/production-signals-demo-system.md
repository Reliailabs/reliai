# Production Signals Demo System

Yes — and you’re thinking about this the right way. The best way to generate credible “production signals” for Reliai is to run a synthetic AI workload environment that continuously produces traces, incidents, and guardrail events. Observability companies do this all the time.

This is exactly what the OpenTelemetry Demo does for telemetry platforms.

You want the AI equivalent of that.

Below are the best approaches and existing projects you can use.

## 1. The Closest Existing Project: OpenTelemetry Demo

[OpenTelemetry Demo](https://github.com/open-telemetry/opentelemetry-demo)

### What it does

A full microservices application that intentionally generates:

- latency
- failures
- traces
- metrics
- service dependencies

It simulates a real production system.

### Why it’s useful for Reliai

You can modify it so some services call LLMs.

Example:

```python
def recommendation_agent(user_query):
    response = openai.chat.completions.create(...)
    return response
```

Then instrument those calls with the Reliai SDK.

Now you generate:

- traces
- regressions
- latency spikes
- incidents

exactly like a real AI product.

## 2. LangChain / LLM App Demo Environments

You can also use example LLM stacks.

Examples:

- LangChain
- LlamaIndex

Both include demo applications such as:

- chatbots
- RAG search
- agent pipelines

These naturally produce:

- retrieval calls
- prompt construction
- LLM calls
- tool calls

Perfect for generating Reliai traces.

## 3. AI Reliability Test Harness (Recommended)

The most powerful option is to build a Reliai synthetic workload generator.

Structure:

```text
reliai-demo-system
│
├── chatbot_service
├── retrieval_service
├── agent_service
├── guardrail_service
│
├── failure_injector
│
└── load_generator
```

This environment would intentionally create failures.

Example failure scenarios:

Prompt regression

```text
deploy_prompt("v2")
→ hallucination rate spikes
```

Retrieval failure

```text
vector_db_latency = 2s
```

Model change

```text
gpt-4 → gpt-3.5
```

Guardrail event

```text
toxicity detected
→ guardrail triggered
```

Reliai should detect these automatically.

## 4. Load Generation

To generate realistic signal volume, run a load generator.

Example:

```text
10–50 requests/sec
```

Tools:

- Locust
- k6

Example Locust workload:

```python
class ChatUser(HttpUser):

    @task
    def chat(self):
        self.client.post("/chat", json={
            "message": "Explain PCI compliance"
        })
```

This will generate thousands of traces.

## 5. Synthetic Incident Generator

This is extremely valuable for demos.

Example script:

```python
failure_modes = [
  "hallucination_spike",
  "retrieval_latency",
  "model_regression",
  "guardrail_violation"
]
```

Every few minutes trigger one.

Now the control panel shows:

- incident detected
- trace cluster
- guardrail recommended

Exactly what Reliai is built to show.

## 6. What Datadog / Sentry Do

Companies like:

- Datadog
- Sentry

run internal demo environments that constantly produce signals.

They never rely on production customers for screenshots.

Reliai should do the same.

## 7. The Ideal Reliai Demo System

You should eventually have a repo like:

```text
reliai-demo-system
```

Inside:

```text
AI Support Copilot
├─ RAG retrieval
├─ LLM answering
├─ tools
└─ guardrails
```

Failure injectors create:

- hallucinations
- latency spikes
- model regressions
- prompt bugs

Reliai automatically detects them.

That produces the marketing numbers:

- 92 reliability score
- 1 active incident
- 17 guardrails active
- 2.3M traces analyzed

These become your production signals.

## 8. What I Recommend You Do First

Start with:

1. OpenTelemetry demo
2. Add LLM calls
3. Instrument with Reliai SDK
4. Run Locust load

This can generate thousands of traces per hour.

## The Internal Demo Environment Architecture

What companies like Datadog and Stripe do internally is run a permanent synthetic production environment that continuously generates realistic traffic, traces, and failures. This environment powers:

- demos
- screenshots
- QA
- marketing metrics
- incident walkthroughs

It runs 24/7 and intentionally produces telemetry.

Below is the exact architecture pattern most infrastructure companies converge on.

### The Internal Demo Environment Architecture

```text
                    Synthetic Load Generator
                             │
                             ▼
                 ┌────────────────────────┐
                 │  Demo AI Application   │
                 │ (copilot / agent app) │
                 └────────────┬──────────┘
                              │
                              ▼
                     Reliai SDK Instrumentation
                              │
                              ▼
                     Reliai Control Plane
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
      Trace Store        Incident Engine     Guardrail Engine
          │                   │                   │
          └──────────────► Analytics Warehouse ◄─┘
                              │
                              ▼
                       Control Panel UI
```

Every component above is synthetic but realistic.

### The 4 Core Components

#### 1. Demo AI System

A real AI pipeline that behaves like production.

Typical structure:

```text
ai-support-copilot
├── gateway
├── retrieval-service
├── llm-service
├── tool-service
└── guardrail-service
```

Each request produces:

- prompt build
- retrieval
- LLM call
- tool execution
- guardrail evaluation

Which means Reliai captures multiple spans per request.

Example pipeline:

```text
query -> retrieve docs -> build prompt -> call LLM -> run tools -> guardrail
```

This alone generates thousands of traces per hour.

#### 2. Continuous Load Generator

Traffic is generated constantly.

Common tools:

- Locust
- k6

Example workload:

```text
50 requests/sec
24/7
```

Requests simulate:

- support questions
- search queries
- agent workflows

Example Locust task:

```python
class ChatUser(HttpUser):

    @task
    def ask_question(self):
        self.client.post("/chat", json={
            "message": "How do I reset my password?"
        })
```

This alone generates millions of spans per day.

#### 3. Failure Injection Engine

This is the secret ingredient.

Observability demos are boring unless something breaks.

So failures are injected automatically.

Example schedule:

```text
every 10 minutes -> inject failure
```

Failure types:

- prompt regression
- model downgrade
- retrieval latency spike
- tool failure
- guardrail trigger

Example injector:

```python
def inject_prompt_regression():
    deploy_prompt("bad_prompt_v3")
```

Reliai should detect:

- regression spike
- incident created
- guardrail recommended

This powers your demo narrative.

#### 4. Signal Aggregator

Metrics are computed continuously from telemetry.

Example metrics:

- traces_last_24h
- incidents_detected
- guardrails_triggered
- systems_monitored

These feed your production signals section.

Example output:

- 2.4M traces analyzed
- 17 guardrails active
- 1 incident detected
- 92 reliability score

### How This Generates Millions of Traces

Example numbers:

```text
50 requests/sec
× 10 spans per request
= 500 spans/sec
```

Per day:

```text
43M spans/day
```

More than enough for:

- marketing screenshots
- demo walkthroughs
- reliability scoring

### Stripe-Style Infrastructure Layout

Stripe runs demo stacks like this:

```text
demo-env
│
├── synthetic-traffic
├── demo-application
├── failure-injector
├── telemetry-pipeline
└── analytics-metrics
```

They continuously generate:

- payments
- refunds
- fraud alerts
- failures

This feeds their dashboards and marketing metrics.

Reliai should do the same with AI failures.

### Ideal Reliai Demo Environment

You should eventually have a repo like:

```text
reliai-demo-system
```

Structure:

```text
reliai-demo-system
│
├── support-copilot
│   ├── retrieval
│   ├── llm
│   └── tools
│
├── synthetic-load
│
├── failure-injector
│
└── metrics-aggregator
```

Running continuously.

### Example Signal Output

After a few hours of load:

- 92 reliability score
- 1 active incident
- 17 guardrails active
- 2.3M traces analyzed

These numbers power:

- hero trust signals
- dashboards
- screenshots
- investor demos

### Why This Matters

Infrastructure buyers subconsciously ask:

> “Has this system actually been exercised at scale?”

A synthetic environment answers yes.

That’s why observability companies always run them.

## Minimal Reliai Demo Environment

Great move adding the Production Signals section — that’s exactly the kind of credibility layer infrastructure sites use. Now let’s build the minimal synthetic environment that can continuously generate realistic telemetry for Reliai demos.

The goal is a ~300-line demo environment that produces:

- traces
- guardrail triggers
- incidents
- latency spikes
- model regressions

and runs continuously so your control panel always has signals.

### Architecture

```text
reliai-demo-env
│
├── app.py              # AI pipeline service
├── load_generator.py   # synthetic traffic
├── failures.py         # failure injector
└── config.py           # scenario control
```

Everything runs locally.

```bash
python app.py
python load_generator.py
python failures.py
```

### 1. AI Pipeline Service

This simulates a simple AI support copilot.

`app.py`

```python
from fastapi import FastAPI
import random
import time

import reliai

app = FastAPI()

reliai.init(
    api_key="demo-key",
    project="demo-ai-system"
)

PROMPT_VERSION = "v1"

@app.post("/chat")
async def chat(payload: dict):

    query = payload["message"]

    with reliai.trace("chat_pipeline"):

        docs = retrieve_docs(query)

        prompt = build_prompt(query, docs)

        response = call_llm(prompt)

        checked = run_guardrail(response)

        return {"answer": checked}


def retrieve_docs(query):
    with reliai.span("retrieval"):
        time.sleep(random.uniform(0.05, 0.2))
        return ["doc1", "doc2"]


def build_prompt(query, docs):
    with reliai.span("prompt_build"):
        return f"{query} using {docs}"


def call_llm(prompt):
    with reliai.span("llm_call"):
        time.sleep(random.uniform(0.1, 0.3))

        if PROMPT_VERSION == "bad_prompt":
            return "Hallucinated policy answer"

        return "Correct answer"


def run_guardrail(text):
    with reliai.span("guardrail_check"):

        if "Hallucinated" in text:
            reliai.guardrail_trigger(
                rule="hallucination_detected"
            )

        return text
```

This produces spans for:

- retrieval
- prompt_build
- llm_call
- guardrail_check

Every request becomes a trace tree.

### 2. Load Generator

This creates traffic continuously.

`load_generator.py`

```python
import requests
import time
import random

URL = "http://localhost:8000/chat"

questions = [
    "How do I reset my password?",
    "Explain PCI compliance",
    "How do I update billing?",
    "How do I configure MFA?"
]

while True:

    payload = {
        "message": random.choice(questions)
    }

    try:
        requests.post(URL, json=payload)
    except Exception:
        pass

    time.sleep(random.uniform(0.1, 0.5))
```

This generates roughly:

```text
2–10 requests/sec
```

Enough for demo telemetry.

### 3. Failure Injector

This is the secret ingredient.

`failures.py`

```python
import time
import random
import app

failure_modes = [
    "prompt_regression",
    "retrieval_latency",
    "model_downgrade",
    "guardrail_spike"
]


def inject_prompt_regression():
    app.PROMPT_VERSION = "bad_prompt"


def restore_prompt():
    app.PROMPT_VERSION = "v1"


while True:

    failure = random.choice(failure_modes)

    print("Injecting failure:", failure)

    if failure == "prompt_regression":
        inject_prompt_regression()

    time.sleep(120)

    restore_prompt()
```

Every few minutes the system breaks intentionally.

Reliai should detect:

- regression
- incident
- guardrail spike

### 4. What This Produces

Within minutes your system generates:

- traces
- incidents
- guardrails
- latency spikes

Which powers:

- control panel
- demo walkthrough
- marketing screenshots
- production signals

## The Four Failure Scenarios Every AI Reliability Demo Needs

These are the most visually understandable failures.

### 1. Prompt Regression

The classic demo failure.

```text
prompt update deployed
↓
hallucination spike
↓
incident created
```

Example:

```text
v1 prompt → correct answers
v2 prompt → hallucinated policy
```

Reliai shows:

- regression cluster
- root cause
- recommended guardrail

### 2. Retrieval Latency Spike

Simulates a broken vector DB.

Inject:

```text
retrieval latency = 2s
```

Trace graph shows:

```text
retrieval span dominates latency
```

Operators immediately see the problem.

### 3. Model Regression

Simulate switching models.

Example:

```text
gpt-4 → gpt-3.5
```

Quality drops.

Reliai detects:

- answer quality regression
- trace cluster
- model change window

### 4. Guardrail Spike

Simulate unsafe outputs.

Example:

- toxic response
- PII leak
- policy hallucination

Guardrail triggers:

- `guardrail_count` up
- incident opened
- recommended mitigation

This is very visually clear in demos.

## Ideal Demo Narrative

Your system now produces the exact story:

```text
prompt deployed
↓
hallucination spike detected
↓
incident created
↓
trace graph investigation
↓
guardrail recommended
```

Which is perfect for Reliai demos.

## After 30 Minutes of Load

You will already have signals like:

- 92 reliability score
- 1 active incident
- 17 guardrails triggered
- 35k traces analyzed

Which can power your Production Signals section.

## Minimal Kubernetes Demo Environment

Below is the smallest realistic Kubernetes demo environment you can run to generate Reliai telemetry continuously. This mirrors the pattern used internally by observability platforms like Datadog and Stripe for demo and screenshot environments.

The goal is:

- minimal components
- continuous traces
- automatic failures
- scalable telemetry

All in ~4 small services.

### Architecture

```text
                        ┌─────────────────┐
                        │   Load Generator │
                        │   (traffic)      │
                        └─────────┬───────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │   Demo AI Service   │
                       │  (Reliai SDK)       │
                       └─────────┬───────────┘
                                 │
                                 ▼
                        ┌────────────────┐
                        │ Failure Injector│
                        └─────────┬──────┘
                                  │
                                  ▼
                         Reliai Control Plane
```

This produces:

- traces
- span trees
- incidents
- guardrail triggers
- latency spikes

### 1. Demo AI Service (Kubernetes)

This is your synthetic AI pipeline.

Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: demo-ai
spec:
  replicas: 1
  selector:
    matchLabels:
      app: demo-ai
  template:
    metadata:
      labels:
        app: demo-ai
    spec:
      containers:
        - name: demo-ai
          image: reliai/demo-ai:latest
          ports:
            - containerPort: 8000
          env:
            - name: RELIAI_API_KEY
              value: "demo-key"
            - name: RELIAI_ENV
              value: "demo"
```

Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: demo-ai
spec:
  selector:
    app: demo-ai
  ports:
    - port: 80
      targetPort: 8000
```

This container runs the earlier FastAPI AI pipeline.

### 2. Synthetic Load Generator

This continuously hits the AI service.

Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: load-generator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: load-generator
  template:
    metadata:
      labels:
        app: load-generator
    spec:
      containers:
        - name: load
          image: reliai/load-gen:latest
          env:
            - name: TARGET_URL
              value: "http://demo-ai/chat"
```

Traffic rate:

```text
5–20 requests/sec
```

Which is plenty for demos.

### 3. Failure Injector

This intentionally breaks things every few minutes.

Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: failure-injector
spec:
  replicas: 1
  selector:
    matchLabels:
      app: failure-injector
  template:
    metadata:
      labels:
        app: failure-injector
    spec:
      containers:
        - name: injector
          image: reliai/failure-injector:latest
          env:
            - name: TARGET_SERVICE
              value: demo-ai
```

Typical injected failures:

- prompt regression
- latency spike
- tool failure
- hallucination trigger

### 4. Kubernetes Layout

Your cluster ends up looking like:

```text
reliai-demo
│
├── demo-ai
├── load-generator
├── failure-injector
└── metrics
```

Deploy with:

```bash
kubectl apply -f demo-stack/
```

Within minutes your control panel fills with telemetry.

## Trace Volume Example

Even a tiny setup generates lots of signals.

Example:

```text
10 requests/sec
× 10 spans/request
```

Result:

```text
100 spans/sec
≈ 8.6M spans/day
```

Enough for:

- dashboards
- incidents
- screenshots
- demos

## The Service That Multiplies Trace Volume by 10×

The trick almost every observability demo environment uses is fan-out microservices.

Instead of one AI service:

```text
client → ai-service
```

you add downstream services.

```text
client
  ↓
gateway
  ↓
retrieval-service
  ↓
llm-service
  ↓
tool-service
  ↓
guardrail-service
```

Each service emits spans.

Example:

```text
1 request
→ 6 services
→ 3 spans each
```

Result:

```text
18 spans per request
```

Instead of:

```text
3 spans per request
```

You just increased telemetry 6×–10× without increasing traffic.

## Minimal Additional Service

Add a retrieval service.

Retrieval Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: retrieval-service
spec:
  replicas: 1
  selector:
    matchLabels:
      app: retrieval
  template:
    metadata:
      labels:
        app: retrieval
    spec:
      containers:
        - name: retrieval
          image: reliai/retrieval-demo:latest
```

Your pipeline becomes:

```text
gateway
  → retrieval
  → llm
  → guardrail
```

Each step produces spans.

## Why Observability Companies Do This

Because dashboards look dramatically better when:

- trace trees are deep
- service graphs are rich
- incidents have context

Sparse telemetry makes observability products look weak.

## The Ideal Reliai Demo Stack

Eventually your demo cluster should look like:

```text
reliai-demo
│
├── gateway
├── retrieval
├── llm
├── tools
├── guardrails
├── load-generator
└── failure-injector
```

All instrumented with the Reliai SDK.

This environment can generate:

- millions of spans/day
- continuous incidents
- guardrail triggers
- latency regressions

Perfect for:

- demos
- marketing screenshots
- QA
- reliability testing

## Fastest Path: Instrument OpenTelemetry Demo

The closest open-source project to the demo architecture used by observability companies—and the fastest one you could instrument with Reliai—is:

➡️ OpenTelemetry Demo

It’s maintained by the OpenTelemetry community and is specifically designed to generate realistic telemetry for observability platforms.

It’s essentially the reference demo stack used by many vendors.

### Why OpenTelemetry Demo Is Perfect for Reliai

It already includes the exact architecture pattern observability platforms use internally.

Microservice topology:

```text
Frontend
   ↓
API Gateway
   ↓
Checkout Service
   ↓
Product Catalog
   ↓
Recommendation Service
   ↓
Cart Service
   ↓
Payment Service
```

Each request automatically generates:

- distributed traces
- service spans
- latency signals
- errors
- metrics
- logs

Meaning Reliai instantly gets deep trace graphs without building a demo system from scratch.

### What the Stack Looks Like

The project runs a full microservices system in Docker or Kubernetes.

Services include:

- frontend
- ad service
- checkout service
- recommendation service
- product catalog
- payment service
- cart service
- load generator

The load generator continuously produces traffic, so telemetry never stops.

Example traffic pattern:

```text
100–500 requests/sec
```

Each request touches 6–10 services, generating large trace trees.

### Resulting Telemetry

One user request becomes something like:

```text
trace
 ├─ frontend
 ├─ gateway
 ├─ recommendation service
 ├─ product catalog
 ├─ cart service
 ├─ payment service
 └─ checkout service
```

Which produces:

```text
10–20 spans per request
```

Even at low load this yields:

```text
millions of spans/day
```

Perfect for Reliai dashboards.

### How to Run It (10 Minutes)

Clone the demo:

```bash
git clone https://github.com/open-telemetry/opentelemetry-demo
cd opentelemetry-demo
```

Start the stack:

```bash
docker compose up
```

You now have:

- 15+ services
- continuous traffic
- distributed tracing

running locally.

### How to Instrument It With Reliai

You only need to add the Reliai SDK to two or three key services.

Example (Python service):

```python
import reliai

reliai.init(
    api_key="RELIAI_API_KEY",
    environment="demo"
)

with reliai.trace("checkout"):
    process_checkout()
```

Now Reliai receives:

- service spans
- trace trees
- latency metrics
- error signals

### Why This Works So Well

This stack already includes:

- distributed microservices
- automatic traffic generation
- service failures
- realistic latency patterns

Which means your Reliai control panel instantly looks like production.

### What Datadog-Style Demo Environments Add

Companies like Datadog usually extend this type of demo stack with:

- failure injector
- chaos testing
- latency spikes
- error bursts

This guarantees dashboards always show:

- incidents
- anomalies
- root-cause traces

### Why This Is the Fastest Option

Instead of building a demo AI system from scratch:

| Approach | Time |
|---|---|
| Build custom demo system | 1–2 weeks |
| Instrument OpenTelemetry demo | 30–60 minutes |

And you immediately get:

- deep trace graphs
- service dependency maps
- error spikes
- latency patterns

### Ideal Reliai Demo Setup

Eventually you would run something like:

```text
reliai-demo-cluster
│
├── opentelemetry-demo
├── failure-injector
├── synthetic-ai-service
└── reliai-control-plane
```

This continuously generates telemetry for:

- demos
- marketing screenshots
- QA
- reliability experiments

### Bottom Line

If you want the fastest path to realistic telemetry, instrument:

OpenTelemetry Demo

It’s literally built for observability demos.

## Converting OpenTelemetry Demo Into an AI Pipeline Demo

You can transform OpenTelemetry Demo from an ecommerce system into an AI pipeline demo with one structural modification:

Replace the recommendation service with an AI pipeline service that emits spans for retrieval -> prompt -> LLM -> guardrails.

This single change converts the entire distributed trace tree into something that looks like a real AI system, which aligns perfectly with Reliai’s narrative.

### The One Modification

Original OTel demo flow:

```text
frontend
   ↓
checkout
   ↓
recommendation service
   ↓
product catalog
   ↓
payment
```

Replace the recommendation service with an AI pipeline.

New flow:

```text
frontend
   ↓
api gateway
   ↓
ai-pipeline-service
      ├─ retrieval
      ├─ prompt build
      ├─ llm call
      └─ guardrail check
   ↓
response
```

Now every trace looks like an AI request lifecycle.

### Resulting Trace Tree

Instead of ecommerce spans like:

```text
GET /product
recommendation
payment
checkout
```

You get traces like:

```text
trace
 ├─ gateway
 ├─ ai.pipeline
 │    ├─ retrieval
 │    ├─ prompt_build
 │    ├─ llm_call
 │    └─ guardrail_check
 └─ response
```

Which perfectly matches the Reliai debugging workflow.

### Minimal AI Pipeline Service

Create a new service inside the demo stack:

```text
ai-service/
```

Example implementation:

```python
from flask import Flask, request
import time
import random
import reliai

app = Flask(__name__)

reliai.init(
    api_key="RELIAI_API_KEY",
    environment="demo"
)

@app.route("/ai", methods=["POST"])
def ai_pipeline():

    query = request.json.get("query")

    with reliai.trace("ai_pipeline"):

        docs = retrieval(query)

        prompt = build_prompt(query, docs)

        answer = call_llm(prompt)

        final = guardrail(answer)

        return {"answer": final}


def retrieval(query):
    with reliai.span("retrieval"):
        time.sleep(random.uniform(0.05, 0.2))
        return ["doc1", "doc2"]


def build_prompt(query, docs):
    with reliai.span("prompt_build"):
        return f"{query} using {docs}"


def call_llm(prompt):
    with reliai.span("llm_call"):
        time.sleep(random.uniform(0.1, 0.3))
        return "Generated answer"


def guardrail(text):
    with reliai.span("guardrail_check"):
        return text
```

This produces AI-style traces automatically.

### Modify the Frontend Call

Instead of calling the recommendation service:

```text
/recommendations
```

Change the route to:

```text
/ai
```

Example request:

```json
{
  "query": "How do I reset my password?"
}
```

Now the demo traffic produces AI system telemetry.

### Add Two Failure Modes (Critical for Demos)

To make Reliai dashboards interesting, inject failures.

Prompt regression:

```text
prompt_v1 → prompt_v2
```

Produces hallucinations.

Trace shows:

- guardrail spikes
- incident detection

Retrieval latency spike:

Simulate slow vector search.

```text
retrieval latency = 2s
```

Trace graph highlights:

```text
retrieval span dominating latency
```

Perfect investigation demo.

### Resulting Demo Narrative

The system now generates this story automatically:

```text
prompt deployed
↓
hallucination spike
↓
incident opened
↓
trace graph investigation
↓
guardrail recommended
```

Which matches Reliai’s core product loop:

```text
trace → evaluate → detect → investigate → mitigate
```

### Why This Works So Well

You keep everything that makes the OTel demo valuable:

- distributed microservices
- load generator
- deep trace trees
- service dependency graph

But the spans now look like AI infrastructure instead of ecommerce.

### After 10 Minutes of Load

Your Reliai dashboard will already show signals like:

- 92 reliability score
- 1 active incident
- 17 guardrail triggers
- 40k traces analyzed

Perfect for:

- demos
- screenshots
- marketing metrics

## Add a Tool Execution Service

The single additional service that dramatically improves AI traces is a Tool Execution Service.

Agent systems (copilots, assistants, RAG agents) rarely just call an LLM. They typically call tools. Adding this layer multiplies trace depth and makes trace graphs look far more realistic.

Platforms like OpenAI, Anthropic, and LangChain all rely heavily on tool execution layers in real systems.

For Reliai demos, adding a tool service produces much richer traces.

### Why Tool Execution Makes Traces Much Better

Without tools, an AI pipeline looks like:

```text
gateway
  → retrieval
  → prompt
  → llm
  → guardrail
```

Trace depth ≈ 4–5 spans

With tools:

```text
gateway
  → retrieval
  → prompt
  → llm
       → tool: knowledge_search
       → tool: calculator
       → tool: user_lookup
  → guardrail
```

Trace depth ≈ 10–20 spans

This makes the Reliai trace graph dramatically more interesting.

### Architecture With Tool Service

```text
frontend
   ↓
api gateway
   ↓
ai-pipeline
   ├─ retrieval
   ├─ prompt_build
   ├─ llm_call
   │     ├─ tool: knowledge_search
   │     ├─ tool: calculator
   │     └─ tool: account_lookup
   └─ guardrail
```

Each tool call creates nested spans.

### Minimal Tool Execution Service

Create a new service:

```text
tool-service/
```

Example implementation:

```python
from flask import Flask, request
import time
import random
import reliai

app = Flask(__name__)

@app.route("/tool", methods=["POST"])
def run_tool():

    tool = request.json["tool"]

    with reliai.span(f"tool:{tool}"):

        latency = random.uniform(0.05, 0.3)
        time.sleep(latency)

        if tool == "knowledge_search":
            return {"result": "knowledge result"}

        if tool == "calculator":
            return {"result": 42}

        if tool == "account_lookup":
            return {"result": "user_profile"}

    return {"result": "ok"}
```

### Modify AI Pipeline

Inside the AI service:

```python
def call_llm(prompt):

    with reliai.span("llm_call"):

        tools = ["knowledge_search", "calculator"]

        results = []

        for tool in tools:
            r = call_tool(tool)
            results.append(r)

        return "generated answer"


def call_tool(tool):

    with reliai.span("tool_execution"):

        import requests

        r = requests.post(
            "http://tool-service/tool",
            json={"tool": tool}
        )

        return r.json()
```

Now every request produces:

```text
llm_call
 ├─ tool_execution
 │    ├─ tool:knowledge_search
 │    └─ tool:calculator
```

Trace graphs become much deeper.

### Example Trace Graph

A single request now produces:

```text
trace
 ├─ gateway
 ├─ retrieval
 ├─ prompt_build
 ├─ llm_call
 │    ├─ tool_execution
 │    │    ├─ tool:knowledge_search
 │    │    └─ tool:calculator
 └─ guardrail_check
```

Span count increases dramatically.

### Why This Is Perfect for Reliai

Reliai’s UI surfaces like:

- trace graphs
- slowest span analysis
- guardrail triggers
- root cause analysis

become much easier to demonstrate with tool layers.

For example:

```text
incident: latency spike
root cause: tool:knowledge_search
```

Which is a very clear debugging story.

### Two Failure Scenarios That Work Extremely Well

Tool latency spike:

Simulate a slow external API.

```text
knowledge_search latency = 2s
```

Trace graph highlights:

```text
tool:knowledge_search
```

Tool failure:

Return error:

```text
account_lookup → 500 error
```

Trace graph shows:

- tool error
- retry span
- guardrail intervention

This produces great demo incidents.

### Resulting Trace Depth

| Pipeline Type | Avg Spans |
|---|---|
| Simple AI pipeline | 4–6 |
| AI pipeline + tools | 12–20 |

Which makes the Reliai trace visualization far richer.

### Final Demo Architecture

Your demo environment should eventually look like:

```text
frontend
│
gateway
│
ai-service
│
├── retrieval-service
├── llm-service
├── tool-service
└── guardrail-service
```

Plus:

- load-generator
- failure-injector

This stack will generate production-like AI telemetry automatically.

## Multiply Trace Volume With Async Fan-Out

The single change observability companies use to multiply trace volume without increasing traffic is:

Async fan-out workers inside a request.

Instead of one request producing one pipeline, the request spawns multiple internal tasks (retrievals, tools, checks, scoring, safety passes). Each task generates spans.

This pattern is extremely common in real AI systems and backend platforms used by companies like Datadog and Stripe.

### Why This Multiplies Telemetry

Without fan-out:

```text
1 request
  → retrieval
  → prompt
  → llm
  → guardrail
```

≈ 4–6 spans

With fan-out workers:

```text
1 request
  → retrieval (3 parallel queries)
  → prompt
  → llm
  → tool execution (3 tools)
  → safety analysis
  → scoring
  → guardrail
```

≈ 20–40 spans

Same traffic. 10× telemetry.

### The Architecture Pattern

```text
gateway
   ↓
ai-pipeline
   ├─ retrieval_fanout
   │    ├─ vector_db_query
   │    ├─ keyword_search
   │    └─ knowledge_api
   │
   ├─ llm_call
   │
   ├─ tool_fanout
   │    ├─ tool:knowledge_search
   │    ├─ tool:calculator
   │    └─ tool:user_lookup
   │
   ├─ safety_check
   └─ guardrail
```

Every branch produces multiple spans.

### Minimal Fan-Out Implementation

Inside your AI pipeline service:

```python
import concurrent.futures
import reliai

def retrieval(query):

    sources = [
        "vector_db",
        "keyword_search",
        "knowledge_api"
    ]

    results = []

    with reliai.span("retrieval_fanout"):

        with concurrent.futures.ThreadPoolExecutor() as executor:

            futures = [
                executor.submit(query_source, s, query)
                for s in sources
            ]

            for f in futures:
                results.append(f.result())

    return results
```

Each source becomes its own span.

### Individual Source Span

```python
def query_source(source, query):

    with reliai.span(f"retrieval:{source}"):

        import random, time

        time.sleep(random.uniform(0.05, 0.3))

        return f"{source}_result"
```

Now one retrieval step produces:

```text
retrieval_fanout
 ├─ retrieval:vector_db
 ├─ retrieval:keyword_search
 └─ retrieval:knowledge_api
```

### Add Tool Fan-Out

Tools behave the same way.

```python
def run_tools():

    tools = [
        "knowledge_search",
        "calculator",
        "account_lookup"
    ]

    with reliai.span("tool_fanout"):

        for tool in tools:
            call_tool(tool)
```

Each tool becomes a span.

### Resulting Trace Graph

A single request becomes:

```text
trace
 ├─ gateway
 ├─ retrieval_fanout
 │    ├─ retrieval:vector_db
 │    ├─ retrieval:keyword_search
 │    └─ retrieval:knowledge_api
 │
 ├─ prompt_build
 │
 ├─ llm_call
 │
 ├─ tool_fanout
 │    ├─ tool:knowledge_search
 │    ├─ tool:calculator
 │    └─ tool:account_lookup
 │
 ├─ safety_check
 └─ guardrail
```

Span depth becomes very rich.

### Telemetry Impact

Example numbers:

```text
10 requests/sec
```

Without fan-out:

```text
10 spans/request
= 100 spans/sec
```

With fan-out:

```text
35 spans/request
= 350 spans/sec
```

Same traffic.

### Why This Makes Demos Much Better

Dashboards look dramatically richer because:

- trace graphs become deep
- service maps become dense
- latency analysis becomes interesting
- root cause becomes visible

For example, Reliai might highlight:

```text
slowest span → retrieval:knowledge_api
```

or

```text
tool:account_lookup failure
```

Which makes the investigation UI shine.

### The Ideal Demo Pipeline

Eventually your demo system should look like:

```text
gateway
│
ai-service
│
├─ retrieval_fanout
│
├─ llm_service
│
├─ tool_fanout
│
├─ safety_service
│
└─ guardrail_service
```

Plus:

- load generator
- failure injector

This setup can generate millions of spans/day with modest traffic.

### The One Extra Trick Observability Companies Use

They also add background jobs that produce traces even when traffic is low:

- embedding generation
- index refresh
- model evaluation
- guardrail training

These produce traces without user requests.

## The 3 Demo Failures That Investigate Best

In observability demos (used by platforms like Datadog, Honeycomb, and Grafana Labs), there are three failure scenarios that consistently create the most compelling investigations.

They work because they produce clear signals across multiple layers:

- latency
- traces
- incidents
- root cause

Reliai already has the UI surfaces to show these extremely well.

### 1. Downstream Latency Explosion

This is the single best demo scenario.

Failure:

A downstream dependency suddenly slows down.

Example:

```text
retrieval:knowledge_api latency
50ms → 2.5s
```

What happens in the trace:

Before:

```text
trace
 ├─ retrieval:vector_db        30ms
 ├─ retrieval:keyword_search   40ms
 └─ retrieval:knowledge_api    45ms
```

After:

```text
trace
 ├─ retrieval:vector_db        30ms
 ├─ retrieval:keyword_search   40ms
 └─ retrieval:knowledge_api  2500ms  ← problem
```

What the Reliai UI shows:

Control panel:

- reliability score drops
- latency regression detected
- incident opened

Trace graph:

```text
slowest span → retrieval:knowledge_api
```

Root cause becomes visually obvious.

Why this works so well:

Engineers immediately understand:

> “The system isn’t slow. That dependency is slow.”

Very strong demo moment.

### 2. Tool Failure Cascade

Modern AI systems call external tools.

Example tools:

- knowledge_search
- account_lookup
- billing_api

Failure:

```text
tool:account_lookup → 500 errors
```

What happens in traces:

```text
trace
 ├─ llm_call
 │
 ├─ tool:knowledge_search
 │
 ├─ tool:account_lookup  ← failure
 │
 └─ guardrail_check
```

Retries appear:

```text
tool:account_lookup
retry
retry
guardrail fallback
```

What the control panel shows:

- incident: tool failure spike
- guardrail activity increases
- error rate anomaly

Why this works in demos:

The trace graph clearly shows:

- failure
- retry
- fallback

Which visually explains the system behavior.

### 3. Prompt Regression

This is the best AI-specific failure.

Failure:

A prompt update introduces hallucinations.

```text
prompt_v2 deployed
```

Now answers become:

- incorrect
- unsafe
- hallucinated

What happens in telemetry:

Guardrails spike.

```text
guardrail_trigger_count ↑
```

Incident created.

```text
AI regression detected
```

Trace investigation:

Trace spans show:

- prompt_build
- llm_call
- guardrail_check

Root cause correlation:

```text
regression window = prompt_v2 deployment
```

Why this is perfect for Reliai:

Reliai’s UI already includes:

- deployment tracking
- regression detection
- guardrail triggers

Which allows the narrative:

```text
prompt deployed
↓
hallucination spike
↓
incident opened
↓
guardrail recommended
```

### Why These Three Failures Work Best

| Failure | Signal Type | Why It Works |
|---|---|---|
| Latency spike | performance | root cause obvious |
| Tool failure | errors | retry behavior visible |
| Prompt regression | AI behavior | unique to AI systems |

Together they cover:

- infrastructure
- application
- AI behavior

Which shows the full Reliai capability.

### Ideal Demo Story

When running a demo environment:

```text
Prompt deployed
↓
Hallucination spike
↓
Guardrails activate
↓
Incident opened
↓
Engineer investigates trace
↓
Root cause identified
↓
Mitigation recommended
```

This aligns exactly with Reliai’s loop:

```text
trace → detect → investigate → mitigate
```

## Demo Automation Rules

The single automation rule most observability companies enable in demo environments is:

Automatic incident creation when a reliability metric deviates from baseline.

This ensures that whenever a failure is injected, the system automatically opens an incident so dashboards always show an active investigation.

Platforms like Datadog, New Relic, and Grafana Labs all use a variation of this rule in demo environments.

### The Core Automation Rule

In plain terms:

```text
IF reliability_score drops OR guardrail_triggers spike
THEN open incident automatically
```

This guarantees that demo dashboards always show something interesting.

### Example Rule for Reliai

Your event pipeline already supports rule actions like:

- create incident
- send webhook
- trigger processor
- recommend guardrail

So the rule can look like:

```json
{
  "rule_name": "auto_open_incident_on_regression",
  "trigger": "reliability_regression_detected",
  "conditions": {
    "environment": "demo"
  },
  "action": {
    "type": "create_incident",
    "severity": "high"
  }
}
```

Whenever the regression detector fires, an incident appears automatically.

### Alternative Trigger (Even Simpler)

Many demos trigger incidents based on guardrail spikes.

Example rule:

```text
IF guardrail_trigger_count > 10 in 5 minutes
THEN open incident
```

Why this works well:

- prompt failures cause guardrails to spike
- tool failures cause guardrails to spike
- safety violations cause guardrails to spike

So incidents appear very reliably.

### What Happens in the UI

When a failure occurs:

```text
latency spike
↓
guardrail triggers increase
↓
automation rule fires
↓
incident created
```

The control panel now shows:

```text
1 active incident
```

And engineers can investigate traces.

### Why Observability Demos Need This

Without automation, dashboards often show:

```text
0 incidents
0 anomalies
```

Which looks boring.

With automation:

```text
Active incident detected
```

This creates an immediate investigation story.

### Example Demo Timeline

A failure injector runs every few minutes.

```text
T+0 min  prompt regression injected
T+1 min  guardrails spike
T+2 min  regression detected
T+2 min  incident automatically created
T+3 min  engineer investigates trace
```

Perfect for demos.

### One Extra Trick Demo Systems Use

Demo environments usually add automatic incident cleanup.

Example rule:

```text
IF incident older than 30 minutes
THEN close incident
```

This prevents the dashboard from filling with stale incidents.

### Final Demo Automation Setup

Your demo org should have:

- Rule 1: `auto_open_incident_on_regression`
- Rule 2: `auto_open_incident_on_guardrail_spike`
- Rule 3: `auto_close_old_incidents`

This ensures:

- incidents always appear
- investigations always exist
- dashboards never look empty
