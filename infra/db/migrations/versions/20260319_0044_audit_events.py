"""audit events

Revision ID: 20260319_0044
Revises: 20260319_0043
Create Date: 2026-03-19 10:42:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260319_0044"
down_revision: str | Sequence[str] | None = "20260319_0043"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "audit_events",
        sa.Column("id", sa.Uuid(), primary_key=True, nullable=False),
        sa.Column("action", sa.String(length=128), nullable=False),
        sa.Column("actor_type", sa.String(length=32), nullable=False),
        sa.Column("actor_id", sa.Uuid(), nullable=True),
        sa.Column("actor_label", sa.String(length=255), nullable=False),
        sa.Column("target_type", sa.String(length=32), nullable=False),
        sa.Column("target_id", sa.Uuid(), nullable=True),
        sa.Column("target_label", sa.String(length=255), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("reason", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_audit_events_organization_id_organizations"),
        ),
    )
    op.create_index(
        op.f("ix_audit_events_organization_id_created_at"),
        "audit_events",
        ["organization_id", "created_at"],
        unique=False,
    )
    op.create_index(op.f("ix_audit_events_actor_id"), "audit_events", ["actor_id"], unique=False)
    op.create_index(op.f("ix_audit_events_target_id"), "audit_events", ["target_id"], unique=False)

    op.execute(
        sa.text(
            """
            INSERT INTO audit_events (
                id,
                action,
                actor_type,
                actor_label,
                target_type,
                target_label,
                metadata_json,
                reason,
                created_at
            )
            SELECT
                id,
                action,
                'cli',
                actor,
                'user',
                target_email,
                jsonb_build_object('source', 'admin_events_migration'),
                reason,
                created_at
            FROM admin_events
            """
        )
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_events_target_id"), table_name="audit_events")
    op.drop_index(op.f("ix_audit_events_actor_id"), table_name="audit_events")
    op.drop_index(op.f("ix_audit_events_organization_id_created_at"), table_name="audit_events")
    op.drop_table("audit_events")
