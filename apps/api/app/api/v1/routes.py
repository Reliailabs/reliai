from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.api_key import APIKeyCreate, APIKeyCreateResponse, APIKeyRead
from app.schemas.organization import OrganizationCreate, OrganizationRead
from app.schemas.project import ProjectCreate, ProjectRead
from app.schemas.trace import (
    TraceAcceptedResponse,
    TraceDetailRead,
    TraceIngestRequest,
    TraceListQuery,
    TraceListResponse,
)
from app.services.api_keys import authenticate_api_key, create_api_key
from app.services.organizations import create_organization, get_organization
from app.services.projects import create_project, get_project
from app.services.traces import get_trace_detail, ingest_trace, list_traces

router = APIRouter()


@router.get("/health")
def versioned_health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/organizations", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_organization_endpoint(
    payload: OrganizationCreate, db: Session = Depends(get_db)
) -> OrganizationRead:
    return create_organization(db, payload)


@router.get("/organizations/{organization_id}", response_model=OrganizationRead)
def get_organization_endpoint(
    organization_id: UUID, db: Session = Depends(get_db)
) -> OrganizationRead:
    return get_organization(db, organization_id)


@router.post(
    "/organizations/{organization_id}/projects",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_endpoint(
    organization_id: UUID, payload: ProjectCreate, db: Session = Depends(get_db)
) -> ProjectRead:
    return create_project(db, organization_id, payload)


@router.get("/projects/{project_id}", response_model=ProjectRead)
def get_project_endpoint(project_id: UUID, db: Session = Depends(get_db)) -> ProjectRead:
    return get_project(db, project_id)


@router.get("/traces", response_model=TraceListResponse)
def list_traces_endpoint(
    filters: TraceListQuery = Depends(),
    db: Session = Depends(get_db),
) -> TraceListResponse:
    result = list_traces(db, filters)
    return TraceListResponse(items=result.items, next_cursor=result.next_cursor)


@router.get("/traces/{trace_id}", response_model=TraceDetailRead)
def get_trace_detail_endpoint(trace_id: UUID, db: Session = Depends(get_db)) -> TraceDetailRead:
    return get_trace_detail(db, trace_id)


@router.post(
    "/projects/{project_id}/api-keys",
    response_model=APIKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_api_key_endpoint(
    project_id: UUID, payload: APIKeyCreate, db: Session = Depends(get_db)
) -> APIKeyCreateResponse:
    key_record, plaintext_key = create_api_key(db, project_id, payload)
    return APIKeyCreateResponse(
        api_key=plaintext_key, api_key_record=APIKeyRead.model_validate(key_record)
    )


@router.post(
    "/ingest/traces",
    response_model=TraceAcceptedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def ingest_trace_endpoint(
    payload: TraceIngestRequest,
    db: Session = Depends(get_db),
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> TraceAcceptedResponse:
    provided_key = x_api_key
    if provided_key is None and authorization and authorization.lower().startswith("bearer "):
        provided_key = authorization[7:]
    if not provided_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="API key is required"
        )
    api_key = authenticate_api_key(db, provided_key)
    if api_key is None:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")
    trace = ingest_trace(db, api_key, payload)
    return TraceAcceptedResponse(trace_id=trace.id)
