"""org escalation policies organization fk

Revision ID: 20260410_0003
Revises: 20260410_0002
Create Date: 2026-04-10 14:10:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260410_0003"
down_revision: str | Sequence[str] | None = "20260410_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


FK_NAME = op.f("fk_org_escalation_policies_organization_id_organizations")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    foreign_keys = {foreign_key["name"] for foreign_key in inspector.get_foreign_keys("org_escalation_policies")}

    if FK_NAME not in foreign_keys:
        op.create_foreign_key(
            FK_NAME,
            "org_escalation_policies",
            "organizations",
            ["organization_id"],
            ["id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    foreign_keys = {foreign_key["name"] for foreign_key in inspector.get_foreign_keys("org_escalation_policies")}

    if FK_NAME in foreign_keys:
        op.drop_constraint(FK_NAME, "org_escalation_policies", type_="foreignkey")
