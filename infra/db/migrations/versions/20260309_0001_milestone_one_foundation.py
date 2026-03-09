"""milestone one foundation

Revision ID: 20260309_0001
Revises:
Create Date: 2026-03-09 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260309_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "organizations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("plan", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organizations")),
        sa.UniqueConstraint("slug", name=op.f("uq_organizations_slug")),
    )
    op.create_index(op.f("ix_organizations_slug"), "organizations", ["slug"], unique=False)

    op.create_table(
        "organization_members",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("auth_user_id", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_organization_members_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organization_members")),
    )
    op.create_index(
        op.f("ix_organization_members_organization_id"),
        "organization_members",
        ["organization_id"],
        unique=False,
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("environment", sa.String(length=32), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"], ["organizations.id"], name=op.f("fk_projects_organization_id_organizations")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
        sa.UniqueConstraint("organization_id", "slug", name="uq_projects_organization_slug"),
    )
    op.create_index(op.f("ix_projects_organization_id"), "projects", ["organization_id"], unique=False)

    op.create_table(
        "api_keys",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("key_prefix", sa.String(length=24), nullable=False),
        sa.Column("key_hash", sa.Text(), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_api_keys_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_api_keys")),
    )
    op.create_index(op.f("ix_api_keys_key_prefix"), "api_keys", ["key_prefix"], unique=False)
    op.create_index(op.f("ix_api_keys_project_id"), "api_keys", ["project_id"], unique=False)

    op.create_table(
        "onboarding_checklists",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("project_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("api_key_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("first_trace_ingested_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_onboarding_checklists_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_onboarding_checklists")),
        sa.UniqueConstraint("organization_id", name=op.f("uq_onboarding_checklists_organization_id")),
    )
    op.create_index(
        op.f("ix_onboarding_checklists_organization_id"),
        "onboarding_checklists",
        ["organization_id"],
        unique=False,
    )

    op.create_table(
        "traces",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("project_id", sa.Uuid(), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.Column("request_id", sa.String(length=255), nullable=False),
        sa.Column("user_id", sa.String(length=255), nullable=True),
        sa.Column("session_id", sa.String(length=255), nullable=True),
        sa.Column("model_name", sa.String(length=255), nullable=False),
        sa.Column("model_provider", sa.String(length=120), nullable=True),
        sa.Column("prompt_version", sa.String(length=120), nullable=True),
        sa.Column("input_text", sa.Text(), nullable=True),
        sa.Column("output_text", sa.Text(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("completion_tokens", sa.Integer(), nullable=True),
        sa.Column("total_cost_usd", sa.Numeric(precision=12, scale=6), nullable=True),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("error_type", sa.String(length=120), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], name=op.f("fk_traces_project_id_projects")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_traces")),
    )
    op.create_index(op.f("ix_traces_project_id"), "traces", ["project_id"], unique=False)
    op.create_index("ix_traces_project_created_at", "traces", ["project_id", "created_at"], unique=False)
    op.create_index("ix_traces_project_request_id", "traces", ["project_id", "request_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_traces_project_request_id", table_name="traces")
    op.drop_index("ix_traces_project_created_at", table_name="traces")
    op.drop_index(op.f("ix_traces_project_id"), table_name="traces")
    op.drop_table("traces")
    op.drop_index(op.f("ix_onboarding_checklists_organization_id"), table_name="onboarding_checklists")
    op.drop_table("onboarding_checklists")
    op.drop_index(op.f("ix_api_keys_project_id"), table_name="api_keys")
    op.drop_index(op.f("ix_api_keys_key_prefix"), table_name="api_keys")
    op.drop_table("api_keys")
    op.drop_index(op.f("ix_projects_organization_id"), table_name="projects")
    op.drop_table("projects")
    op.drop_index(op.f("ix_organization_members_organization_id"), table_name="organization_members")
    op.drop_table("organization_members")
    op.drop_index(op.f("ix_organizations_slug"), table_name="organizations")
    op.drop_table("organizations")
