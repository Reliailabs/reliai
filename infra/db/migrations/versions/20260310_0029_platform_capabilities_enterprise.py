"""platform capabilities enterprise layer

Revision ID: 20260310_0029
Revises: 20260310_0028
Create Date: 2026-03-11 01:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260310_0029"
down_revision: str | Sequence[str] | None = "20260310_0028"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "public_api_keys",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("key_prefix", sa.String(length=24), nullable=False),
        sa.Column("key_hash", sa.Text(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_public_api_keys_organization_id_organizations")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_public_api_keys")),
    )
    op.create_index(op.f("ix_public_api_keys_organization_id"), "public_api_keys", ["organization_id"], unique=False)
    op.create_index(op.f("ix_public_api_keys_key_prefix"), "public_api_keys", ["key_prefix"], unique=False)

    op.create_table(
        "usage_quotas",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("max_traces_per_day", sa.Integer(), nullable=True),
        sa.Column("max_processors", sa.Integer(), nullable=True),
        sa.Column("max_api_requests", sa.Integer(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_usage_quotas_organization_id_organizations")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_usage_quotas")),
        sa.UniqueConstraint("organization_id", name=op.f("uq_usage_quotas_organization_id")),
    )
    op.create_index(op.f("ix_usage_quotas_organization_id"), "usage_quotas", ["organization_id"], unique=True)

    op.create_table(
        "customer_exports",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("requested_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("export_format", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("content_type", sa.String(length=120), nullable=True),
        sa.Column("row_count", sa.Integer(), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_customer_exports_organization_id_organizations")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_customer_exports_project_id_projects")),
        sa.ForeignKeyConstraint(["requested_by_user_id"], ["users.id"], name=op.f("fk_customer_exports_requested_by_user_id_users")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_customer_exports")),
    )
    op.create_index(op.f("ix_customer_exports_organization_id"), "customer_exports", ["organization_id"], unique=False)
    op.create_index(op.f("ix_customer_exports_project_id"), "customer_exports", ["project_id"], unique=False)
    op.create_index(op.f("ix_customer_exports_requested_by_user_id"), "customer_exports", ["requested_by_user_id"], unique=False)

    op.create_table(
        "sdk_metrics",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("environment_id", sa.Uuid(), nullable=True),
        sa.Column("bucket_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sdk_version", sa.String(length=64), nullable=False),
        sa.Column("language", sa.String(length=32), nullable=False),
        sa.Column("latency_ms_avg", sa.Float(), nullable=True),
        sa.Column("latency_ms_p95", sa.Float(), nullable=True),
        sa.Column("error_rate", sa.Float(), nullable=True),
        sa.Column("request_count", sa.Integer(), nullable=False),
        sa.Column("retry_count", sa.Integer(), nullable=False),
        sa.Column("error_count", sa.Integer(), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["environment_id"], ["environments.id"], name=op.f("fk_sdk_metrics_environment_id_environments")),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_sdk_metrics_organization_id_organizations")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_sdk_metrics_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sdk_metrics")),
        sa.UniqueConstraint(
            "organization_id",
            "project_id",
            "environment_id",
            "bucket_start",
            "sdk_version",
            "language",
            name="uq_sdk_metrics_bucket_scope",
        ),
    )
    op.create_index(op.f("ix_sdk_metrics_organization_id"), "sdk_metrics", ["organization_id"], unique=False)
    op.create_index(op.f("ix_sdk_metrics_project_id"), "sdk_metrics", ["project_id"], unique=False)
    op.create_index(op.f("ix_sdk_metrics_environment_id"), "sdk_metrics", ["environment_id"], unique=False)
    op.create_index(op.f("ix_sdk_metrics_bucket_start"), "sdk_metrics", ["bucket_start"], unique=False)

    op.create_table(
        "platform_extensions",
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("processor_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], name=op.f("fk_platform_extensions_organization_id_organizations")),
        sa.ForeignKeyConstraint(["processor_id"], ["external_processors.id"], name=op.f("fk_platform_extensions_processor_id_external_processors")),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_platform_extensions_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_platform_extensions")),
        sa.UniqueConstraint("processor_id", name=op.f("uq_platform_extensions_processor_id")),
    )
    op.create_index(op.f("ix_platform_extensions_organization_id"), "platform_extensions", ["organization_id"], unique=False)
    op.create_index(op.f("ix_platform_extensions_project_id"), "platform_extensions", ["project_id"], unique=False)
    op.create_index(op.f("ix_platform_extensions_processor_id"), "platform_extensions", ["processor_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_platform_extensions_processor_id"), table_name="platform_extensions")
    op.drop_index(op.f("ix_platform_extensions_project_id"), table_name="platform_extensions")
    op.drop_index(op.f("ix_platform_extensions_organization_id"), table_name="platform_extensions")
    op.drop_table("platform_extensions")

    op.drop_index(op.f("ix_sdk_metrics_bucket_start"), table_name="sdk_metrics")
    op.drop_index(op.f("ix_sdk_metrics_environment_id"), table_name="sdk_metrics")
    op.drop_index(op.f("ix_sdk_metrics_project_id"), table_name="sdk_metrics")
    op.drop_index(op.f("ix_sdk_metrics_organization_id"), table_name="sdk_metrics")
    op.drop_table("sdk_metrics")

    op.drop_index(op.f("ix_customer_exports_requested_by_user_id"), table_name="customer_exports")
    op.drop_index(op.f("ix_customer_exports_project_id"), table_name="customer_exports")
    op.drop_index(op.f("ix_customer_exports_organization_id"), table_name="customer_exports")
    op.drop_table("customer_exports")

    op.drop_index(op.f("ix_usage_quotas_organization_id"), table_name="usage_quotas")
    op.drop_table("usage_quotas")

    op.drop_index(op.f("ix_public_api_keys_key_prefix"), table_name="public_api_keys")
    op.drop_index(op.f("ix_public_api_keys_organization_id"), table_name="public_api_keys")
    op.drop_table("public_api_keys")
