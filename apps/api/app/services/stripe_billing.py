from __future__ import annotations

import logging
import stripe
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.settings import get_settings
from app.models.organization import Organization

logger = logging.getLogger(__name__)


def _stripe_configured() -> bool:
    settings = get_settings()
    return bool(settings.stripe_secret_key and settings.stripe_webhook_secret)


def _configure_stripe() -> None:
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe is not configured")
    stripe.api_key = settings.stripe_secret_key


def _price_ids() -> dict[str, str]:
    settings = get_settings()
    price_map = {
        "team": settings.stripe_price_team_base,
        "production": settings.stripe_price_production_base,
    }
    return {key: value for key, value in price_map.items() if value}


def _usage_price_ids() -> dict[str, str]:
    settings = get_settings()
    usage_map = {
        "team": settings.stripe_price_team_usage,
        "production": settings.stripe_price_production_usage,
    }
    return {key: value for key, value in usage_map.items() if value}


def _plan_from_subscription(subscription: stripe.Subscription, price_map: dict[str, str]) -> str:
    for item in subscription["items"]["data"]:
        price_id = item.get("price", {}).get("id")
        if not price_id:
            continue
        for plan, mapped_price in price_map.items():
            if price_id == mapped_price:
                return plan
    return "free"


def ensure_stripe_customer(db: Session, organization: Organization) -> Organization:
    if organization.stripe_customer_id:
        return organization
    settings = get_settings()
    if not settings.stripe_secret_key:
        return organization
    _configure_stripe()
    customer = stripe.Customer.create(
        name=organization.name,
        metadata={"org_id": str(organization.id), "org_slug": organization.slug},
    )
    organization.stripe_customer_id = customer.id
    db.add(organization)
    db.commit()
    db.refresh(organization)
    return organization


def create_checkout_session(organization: Organization, plan: str, *, success_url: str, cancel_url: str) -> str:
    settings = get_settings()
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe is not configured")
    price_map = _price_ids()
    usage_price_map = _usage_price_ids()
    price_id = price_map.get(plan)
    usage_price_id = usage_price_map.get(plan)
    if not price_id or not usage_price_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported plan")
    _configure_stripe()
    customer_id = organization.stripe_customer_id
    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[
            {"price": price_id, "quantity": 1},
            {"price": usage_price_id},
        ],
        success_url=success_url,
        cancel_url=cancel_url,
        allow_promotion_codes=True,
        metadata={"org_id": str(organization.id), "plan": plan},
    )
    return session.url


def handle_stripe_webhook(db: Session, payload: bytes, signature: str | None) -> None:
    settings = get_settings()
    if not _stripe_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Stripe is not configured")
    if not signature:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing Stripe signature")
    _configure_stripe()
    try:
        event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except stripe.error.SignatureVerificationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid Stripe signature") from exc

    event_type = event.get("type")
    price_map = _price_ids()

    if event_type == "checkout.session.completed":
        session = event["data"]["object"]
        org_id = session.get("metadata", {}).get("org_id")
        subscription_id = session.get("subscription")
        customer_id = session.get("customer")
        if not org_id:
            logger.warning("Stripe checkout session missing org_id metadata")
            return
        organization = db.get(Organization, org_id)
        if not organization:
            logger.warning("Stripe checkout session org not found: %s", org_id)
            return
        if customer_id and not organization.stripe_customer_id:
            organization.stripe_customer_id = customer_id
        if subscription_id:
            organization.stripe_subscription_id = subscription_id
        db.add(organization)
        db.commit()
        return

    if event_type in {"customer.subscription.updated", "customer.subscription.deleted"}:
        subscription = event["data"]["object"]
        customer_id = subscription.get("customer")
        if not customer_id:
            logger.warning("Stripe subscription missing customer id")
            return
        organization = db.scalar(
            select(Organization).where(Organization.stripe_customer_id == customer_id).limit(1)
        )
        if not organization:
            logger.warning("Stripe subscription org not found for customer %s", customer_id)
            return
        if event_type == "customer.subscription.deleted":
            organization.plan = "free"
            organization.stripe_subscription_id = None
        else:
            organization.plan = _plan_from_subscription(subscription, price_map)
            organization.stripe_subscription_id = subscription.get("id")
        db.add(organization)
        db.commit()
        return

    logger.debug("Unhandled Stripe event type: %s", event_type)
