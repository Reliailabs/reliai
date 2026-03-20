from uuid import UUID

from pydantic import BaseModel, Field


class BillingCheckoutRequest(BaseModel):
    organization_id: UUID
    plan: str = Field(..., min_length=1)


class BillingCheckoutResponse(BaseModel):
    checkout_url: str
