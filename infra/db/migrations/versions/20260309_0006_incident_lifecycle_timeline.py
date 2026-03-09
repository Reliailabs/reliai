"""incident lifecycle timeline and org alert targets

Revision ID: 20260309_0006
Revises: 20260309_0005
Create Date: 2026-03-09 18:30:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260309_0006"
down_revision = "20260309_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "alert_deliveries",
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "alert_deliveries",
        sa.Column("last_attempted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "alert_deliveries",
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.alter_column("alert_deliveries", "attempt_count", server_default=None)

    op.create_table(
        "organization_alert_targets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("channel_type", sa.String(length=32), nullable=False),
        sa.Column("channel_target", sa.String(length=255), nullable=False),
        sa.Column("slack_webhook_url", sa.String(length=2000), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_organization_alert_targets_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organization_alert_targets")),
        sa.UniqueConstraint(
            "organization_id",
            name="uq_organization_alert_targets_organization_id",
        ),
    )
    op.create_index(
        op.f("ix_organization_alert_targets_organization_id"),
        "organization_alert_targets",
        ["organization_id"],
        unique=False,
    )

    op.create_table(
        "incident_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("incident_id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("actor_operator_user_id", sa.Uuid(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["actor_operator_user_id"],
            ["operator_users.id"],
            name=op.f("fk_incident_events_actor_operator_user_id_operator_users"),
        ),
        sa.ForeignKeyConstraint(
            ["incident_id"],
            ["incidents.id"],
            name=op.f("fk_incident_events_incident_id_incidents"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_incident_events")),
    )
    op.create_index(op.f("ix_incident_events_incident_id"), "incident_events", ["incident_id"], unique=False)
    op.create_index(
        "ix_incident_events_incident_created_at",
        "incident_events",
        ["incident_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_incident_events_type_created_at",
        "incident_events",
        ["event_type", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_incident_events_type_created_at", table_name="incident_events")
    op.drop_index("ix_incident_events_incident_created_at", table_name="incident_events")
    op.drop_index(op.f("ix_incident_events_incident_id"), table_name="incident_events")
    op.drop_table("incident_events")

    op.drop_index(
        op.f("ix_organization_alert_targets_organization_id"),
        table_name="organization_alert_targets",
    )
    op.drop_table("organization_alert_targets")

    op.drop_column("alert_deliveries", "next_attempt_at")
    op.drop_column("alert_deliveries", "last_attempted_at")
    op.drop_column("alert_deliveries", "attempt_count")
