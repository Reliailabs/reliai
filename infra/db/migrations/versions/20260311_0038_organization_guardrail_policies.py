"""organization guardrail policies

Revision ID: 20260311_0038
Revises: 20260311_0037
Create Date: 2026-03-11 18:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260311_0038"
down_revision: str | Sequence[str] | None = "20260311_0037"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_guardrail_policies",
        sa.Column("organization_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("policy_type", sa.String(length=64), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("enforcement_mode", sa.String(length=16), nullable=False, server_default="observe"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_organization_guardrail_policies_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organization_guardrail_policies")),
    )
    op.create_index(
        "ix_org_guardrail_policies_org_enabled",
        "organization_guardrail_policies",
        ["organization_id", "enabled"],
        unique=False,
    )
    op.create_index(
        "ix_org_guardrail_policies_type_mode",
        "organization_guardrail_policies",
        ["policy_type", "enforcement_mode"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_guardrail_policies_organization_id"),
        "organization_guardrail_policies",
        ["organization_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_organization_guardrail_policies_organization_id"),
        table_name="organization_guardrail_policies",
    )
    op.drop_index("ix_org_guardrail_policies_type_mode", table_name="organization_guardrail_policies")
    op.drop_index("ix_org_guardrail_policies_org_enabled", table_name="organization_guardrail_policies")
    op.drop_table("organization_guardrail_policies")
