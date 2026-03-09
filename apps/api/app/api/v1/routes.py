from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.dependencies import require_operator
from app.db.session import get_db
from app.schemas.api_key import APIKeyCreate, APIKeyCreateResponse, APIKeyRead
from app.schemas.auth import AuthSessionResponse, AuthSignInRequest, OperatorMembershipRead, OperatorRead
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
from app.services.auth import (
    OperatorContext,
    get_operator_memberships,
    revoke_session,
    sign_in_operator,
)
from app.services.authorization import require_organization_membership, require_project_access
from app.services.organizations import create_organization, get_organization
from app.services.projects import create_project
from app.services.traces import get_trace_detail, ingest_trace, list_traces

router = APIRouter()


@router.get("/health")
def versioned_health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/organizations", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
def create_organization_endpoint(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationRead:
    if payload.owner_auth_user_id != str(operator.operator.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
    return create_organization(db, payload)


@router.post("/auth/sign-in", response_model=AuthSessionResponse)
def sign_in_operator_endpoint(
    payload: AuthSignInRequest, db: Session = Depends(get_db)
) -> AuthSessionResponse:
    operator, session, session_token = sign_in_operator(db, payload)
    return AuthSessionResponse(
        session_token=session_token,
        operator=OperatorRead(id=operator.id, email=operator.email),
        memberships=[
            OperatorMembershipRead(organization_id=membership.organization_id, role=membership.role)
            for membership in get_operator_memberships(db, operator.id)
        ],
        expires_at=session.expires_at,
    )


@router.get("/auth/session", response_model=AuthSessionResponse)
def auth_session_endpoint(
    operator: OperatorContext = Depends(require_operator),
) -> AuthSessionResponse:
    return AuthSessionResponse(
        operator=OperatorRead(id=operator.operator.id, email=operator.operator.email),
        memberships=[
            OperatorMembershipRead(organization_id=membership.organization_id, role=membership.role)
            for membership in operator.memberships
        ],
        expires_at=operator.session.expires_at,
    )


@router.post("/auth/sign-out", status_code=status.HTTP_204_NO_CONTENT)
def sign_out_operator_endpoint(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> Response:
    if authorization is None or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    revoke_session(db, authorization[7:])
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/organizations/{organization_id}", response_model=OrganizationRead)
def get_organization_endpoint(
    organization_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> OrganizationRead:
    require_organization_membership(operator, organization_id)
    return get_organization(db, organization_id)


@router.post(
    "/organizations/{organization_id}/projects",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
)
def create_project_endpoint(
    organization_id: UUID,
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectRead:
    require_organization_membership(operator, organization_id)
    return create_project(db, organization_id, payload)


@router.get("/projects/{project_id}", response_model=ProjectRead)
def get_project_endpoint(
    project_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> ProjectRead:
    return require_project_access(db, operator, project_id)


@router.get("/traces", response_model=TraceListResponse)
def list_traces_endpoint(
    filters: TraceListQuery = Depends(),
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceListResponse:
    if filters.project_id is not None:
        require_project_access(db, operator, filters.project_id)
    result = list_traces(db, operator, filters)
    return TraceListResponse(items=result.items, next_cursor=result.next_cursor)


@router.get("/traces/{trace_id}", response_model=TraceDetailRead)
def get_trace_detail_endpoint(
    trace_id: UUID,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> TraceDetailRead:
    return get_trace_detail(db, operator, trace_id)


@router.post(
    "/projects/{project_id}/api-keys",
    response_model=APIKeyCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_api_key_endpoint(
    project_id: UUID,
    payload: APIKeyCreate,
    db: Session = Depends(get_db),
    operator: OperatorContext = Depends(require_operator),
) -> APIKeyCreateResponse:
    project = require_project_access(db, operator, project_id)
    key_record, plaintext_key = create_api_key(db, project.id, payload)
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
