"""alert delivery and incident operator actions

Revision ID: 20260309_0005
Revises: 20260309_0004
Create Date: 2026-03-09 17:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260309_0005"
down_revision = "20260309_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("incidents", sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        "incidents",
        sa.Column("acknowledged_by_operator_user_id", sa.Uuid(), nullable=True),
    )
    op.add_column("incidents", sa.Column("owner_operator_user_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        op.f("fk_incidents_acknowledged_by_operator_user_id_operator_users"),
        "incidents",
        "operator_users",
        ["acknowledged_by_operator_user_id"],
        ["id"],
    )
    op.create_foreign_key(
        op.f("fk_incidents_owner_operator_user_id_operator_users"),
        "incidents",
        "operator_users",
        ["owner_operator_user_id"],
        ["id"],
    )

    op.create_table(
        "alert_deliveries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("incident_id", sa.Uuid(), nullable=False),
        sa.Column("channel_type", sa.String(length=32), nullable=False),
        sa.Column("channel_target", sa.String(length=255), nullable=False),
        sa.Column("delivery_status", sa.String(length=32), nullable=False),
        sa.Column("provider_message_id", sa.String(length=255), nullable=True),
        sa.Column("error_message", sa.String(length=2000), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["incident_id"], ["incidents.id"], name=op.f("fk_alert_deliveries_incident_id_incidents")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_alert_deliveries")),
    )
    op.create_index(op.f("ix_alert_deliveries_incident_id"), "alert_deliveries", ["incident_id"], unique=False)
    op.create_index(
        "ix_alert_deliveries_incident_created_at",
        "alert_deliveries",
        ["incident_id", "created_at"],
        unique=False,
    )
    op.create_index(
        "ix_alert_deliveries_status_created_at",
        "alert_deliveries",
        ["delivery_status", "created_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_alert_deliveries_status_created_at", table_name="alert_deliveries")
    op.drop_index("ix_alert_deliveries_incident_created_at", table_name="alert_deliveries")
    op.drop_index(op.f("ix_alert_deliveries_incident_id"), table_name="alert_deliveries")
    op.drop_table("alert_deliveries")

    op.drop_constraint(
        op.f("fk_incidents_owner_operator_user_id_operator_users"), "incidents", type_="foreignkey"
    )
    op.drop_constraint(
        op.f("fk_incidents_acknowledged_by_operator_user_id_operator_users"),
        "incidents",
        type_="foreignkey",
    )
    op.drop_column("incidents", "owner_operator_user_id")
    op.drop_column("incidents", "acknowledged_by_operator_user_id")
    op.drop_column("incidents", "acknowledged_at")
