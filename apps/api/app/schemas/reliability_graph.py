from datetime import datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from app.schemas.common import APIModel
from app.schemas.incident import IncidentListItemRead
from app.schemas.project import ModelVersionRead, PromptVersionRead
from app.schemas.regression import RegressionSnapshotRead


class GraphTraceEvaluationRead(APIModel):
    id: UUID
    trace_id: UUID
    evaluation_type: str
    score: Decimal | None
    metadata_json: dict[str, Any] | None
    created_at: datetime


class GraphTraceRetrievalSpanRead(APIModel):
    id: UUID
    trace_id: UUID
    retrieval_provider: str | None
    latency_ms: int | None
    chunk_count: int | None
    metadata_json: dict[str, Any] | None
    created_at: datetime


class GraphIncidentRootCauseRead(APIModel):
    id: UUID
    incident_id: UUID
    cause_type: str
    cause_id: str
    confidence_score: Decimal | None
    evidence_json: dict[str, Any] | None
    created_at: datetime


class GraphTraceRead(APIModel):
    id: UUID
    request_id: str
    timestamp: datetime
    success: bool
    error_type: str | None
    latency_ms: int | None
    prompt_version: str | None
    model_name: str
    prompt_version_record: PromptVersionRead | None
    model_version_record: ModelVersionRead | None
    retrieval_span: GraphTraceRetrievalSpanRead | None
    evaluations: list[GraphTraceEvaluationRead]


class IncidentGraphRead(APIModel):
    incident: IncidentListItemRead
    regressions: list[RegressionSnapshotRead]
    traces: list[GraphTraceRead]
    prompt_version: PromptVersionRead | None
    model_version: ModelVersionRead | None
    deployment: dict[str, Any] | None
    evaluations: list[GraphTraceEvaluationRead]
    root_causes: list[GraphIncidentRootCauseRead]
