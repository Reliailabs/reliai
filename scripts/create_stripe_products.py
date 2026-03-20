#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from dataclasses import dataclass

import stripe


@dataclass(frozen=True)
class PlanConfig:
    key: str
    name: str
    description: str
    base_monthly_usd: float
    usage_per_million_usd: float


PLANS = [
    PlanConfig(
        key="team",
        name="Reliai Team",
        description="AI observability for small teams",
        base_monthly_usd=49.0,
        usage_per_million_usd=0.50,
    ),
    PlanConfig(
        key="production",
        name="Reliai Production",
        description="Production-scale AI reliability",
        base_monthly_usd=199.0,
        usage_per_million_usd=0.25,
    ),
]

ENTERPRISE = PlanConfig(
    key="enterprise",
    name="Reliai Enterprise",
    description="Enterprise AI infrastructure",
    base_monthly_usd=0.0,
    usage_per_million_usd=0.0,
)


def require_env() -> str:
    key = os.getenv("STRIPE_SECRET_KEY")
    if not key:
        print("Missing STRIPE_SECRET_KEY in environment.", file=sys.stderr)
        sys.exit(1)
    return key


def upsert_product(plan: PlanConfig) -> stripe.Product:
    existing = stripe.Product.search(query=f"name:'{plan.name}'").data
    if existing:
        return existing[0]
    return stripe.Product.create(
        name=plan.name,
        description=plan.description,
        metadata={"plan_key": plan.key},
    )


def create_base_price(product_id: str, plan: PlanConfig, version: str) -> stripe.Price:
    lookup_key = f"price_reliai_{plan.key}_monthly_{version}"
    prices = stripe.Price.search(query=f"lookup_key:'{lookup_key}'").data
    if prices:
        return prices[0]
    amount_cents = int(round(plan.base_monthly_usd * 100))
    return stripe.Price.create(
        product=product_id,
        unit_amount=amount_cents,
        currency="usd",
        recurring={"interval": "month", "usage_type": "licensed"},
        nickname=f"{plan.name} monthly {version}",
        lookup_key=lookup_key,
        metadata={"plan_key": plan.key, "type": "base", "version": version},
    )


def create_usage_price(product_id: str, plan: PlanConfig, version: str, meter_id: str | None) -> stripe.Price:
    lookup_key = f"price_reliai_{plan.key}_usage_{version}"
    prices = stripe.Price.search(query=f"lookup_key:'{lookup_key}'").data
    if prices:
        return prices[0]
    amount_cents = int(round(plan.usage_per_million_usd * 100))
    payload = dict(
        product=product_id,
        unit_amount=amount_cents,
        currency="usd",
        recurring={"interval": "month", "usage_type": "metered"},
        billing_scheme="per_unit",
        transform_quantity={"divide_by": 1_000_000, "round": "up"},
        nickname=f"{plan.name} usage {version}",
        lookup_key=lookup_key,
        metadata={"plan_key": plan.key, "type": "usage", "version": version},
    )
    if meter_id:
        payload["meter"] = meter_id
    return stripe.Price.create(**payload)


def main() -> None:
    parser = argparse.ArgumentParser(description="Create Reliai Stripe products and prices.")
    parser.add_argument("--version", default="v1", help="Price version suffix (default: v1)")
    parser.add_argument("--team-base", type=float, default=PLANS[0].base_monthly_usd)
    parser.add_argument("--team-usage", type=float, default=PLANS[0].usage_per_million_usd)
    parser.add_argument("--production-base", type=float, default=PLANS[1].base_monthly_usd)
    parser.add_argument("--production-usage", type=float, default=PLANS[1].usage_per_million_usd)
    parser.add_argument("--team-meter", help="Stripe meter ID for team usage price")
    parser.add_argument("--production-meter", help="Stripe meter ID for production usage price")
    args = parser.parse_args()

    stripe.api_key = require_env()

    plan_map = {
        "team": PLANS[0].__class__(
            key="team",
            name=PLANS[0].name,
            description=PLANS[0].description,
            base_monthly_usd=args.team_base,
            usage_per_million_usd=args.team_usage,
        ),
        "production": PLANS[1].__class__(
            key="production",
            name=PLANS[1].name,
            description=PLANS[1].description,
            base_monthly_usd=args.production_base,
            usage_per_million_usd=args.production_usage,
        ),
    }

    enterprise_product = upsert_product(ENTERPRISE)
    print(f"Enterprise product: {enterprise_product.id}")

    outputs: dict[str, str] = {}
    for plan in ("team", "production"):
        config = plan_map[plan]
        product = upsert_product(config)
        base_price = create_base_price(product.id, config, args.version)
        meter_id = args.team_meter if plan == "team" else args.production_meter
        usage_price = create_usage_price(product.id, config, args.version, meter_id)
        outputs[f"STRIPE_PRICE_{plan.upper()}_BASE"] = base_price.id
        outputs[f"STRIPE_PRICE_{plan.upper()}_USAGE"] = usage_price.id
        print(f"{config.name} product: {product.id}")
        print(f"  base price: {base_price.id} ({config.base_monthly_usd}/mo)")
        print(f"  usage price: {usage_price.id} ({config.usage_per_million_usd} per 1M)")

    print("\nEnv config:")
    for key, value in outputs.items():
        print(f"{key}={value}")


if __name__ == "__main__":
    main()
