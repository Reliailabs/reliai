from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services.auth import OperatorContext, get_operator_context


def require_operator(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> OperatorContext:
    if authorization is None or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    token = authorization[7:]
    return get_operator_context(db, token)
