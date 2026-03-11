from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.common import APIModel
from app.schemas.incident import IncidentListItemRead
from app.schemas.project import ModelVersionRead, PromptVersionRead


class ReliabilityGraphNodeRead(APIModel):
    id: UUID
    node_type: str
    node_key: str
    metadata_json: dict | None = None
    trace_count: int
    first_seen: datetime
    last_seen: datetime


class ReliabilityGraphEdgeRead(APIModel):
    id: UUID
    source_type: str
    source_id: UUID
    target_type: str
    target_id: UUID
    relationship_type: str
    weight: float
    confidence: float
    trace_count: int
    created_at: datetime
    updated_at: datetime


class ReliabilityGraphRelatedNodeRead(BaseModel):
    node: ReliabilityGraphNodeRead
    edge: ReliabilityGraphEdgeRead


class ReliabilityGraphOverviewRead(BaseModel):
    nodes: list[ReliabilityGraphNodeRead]
    edges: list[ReliabilityGraphEdgeRead]


class ReliabilityGraphNodeDetailRead(BaseModel):
    node: ReliabilityGraphNodeRead
    related: list[ReliabilityGraphRelatedNodeRead]


class ReliabilityGraphPatternRead(BaseModel):
    pattern: str
    risk_level: str
    traces: int
    confidence: float
    source_node_id: UUID
    target_node_id: UUID
    relationship_type: str


class ReliabilityGraphPatternListResponse(BaseModel):
    items: list[ReliabilityGraphPatternRead]


class GraphGuardrailRecommendationRead(BaseModel):
    policy_type: str
    recommended_action: str
    title: str
    description: str
    confidence: float


class GraphGuardrailRecommendationListResponse(BaseModel):
    items: list[GraphGuardrailRecommendationRead]


class GraphTraceEvaluationRead(APIModel):
    id: UUID
    trace_id: UUID
    evaluation_type: str
    score: float | None = None
    metadata_json: dict | None = None
    created_at: datetime


class GraphTraceRetrievalSpanRead(APIModel):
    id: UUID
    trace_id: UUID
    retrieval_provider: str | None = None
    latency_ms: int | None = None
    chunk_count: int | None = None
    metadata_json: dict | None = None
    created_at: datetime


class GraphTraceRead(BaseModel):
    id: UUID
    request_id: str
    timestamp: datetime
    success: bool
    error_type: str | None = None
    latency_ms: int | None = None
    prompt_version: str | None = None
    model_name: str
    prompt_version_record: PromptVersionRead | None = None
    model_version_record: ModelVersionRead | None = None
    retrieval_span: GraphTraceRetrievalSpanRead | None = None
    evaluations: list[GraphTraceEvaluationRead]


class GraphIncidentRootCauseRead(APIModel):
    id: UUID
    incident_id: UUID
    cause_type: str
    cause_id: str
    confidence_score: float | None = None
    evidence_json: dict | None = None
    created_at: datetime


class IncidentGraphRead(BaseModel):
    incident: IncidentListItemRead
    regressions: list
    traces: list[GraphTraceRead]
    prompt_version: PromptVersionRead | None = None
    model_version: ModelVersionRead | None = None
    deployment: dict | None = None
    evaluations: list[GraphTraceEvaluationRead]
    root_causes: list[GraphIncidentRootCauseRead]
