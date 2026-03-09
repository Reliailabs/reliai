"""operator auth scaffold

Revision ID: 20260309_0003
Revises: 20260309_0002
Create Date: 2026-03-09 01:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260309_0003"
down_revision = "20260309_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "operator_users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_operator_users")),
        sa.UniqueConstraint("email", name=op.f("uq_operator_users_email")),
    )
    op.create_index(op.f("ix_operator_users_email"), "operator_users", ["email"], unique=False)

    op.create_table(
        "operator_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("operator_user_id", sa.Uuid(), nullable=False),
        sa.Column("session_token_hash", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["operator_user_id"],
            ["operator_users.id"],
            name=op.f("fk_operator_sessions_operator_user_id_operator_users"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_operator_sessions")),
        sa.UniqueConstraint("session_token_hash", name=op.f("uq_operator_sessions_session_token_hash")),
    )
    op.create_index(
        op.f("ix_operator_sessions_operator_user_id"),
        "operator_sessions",
        ["operator_user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_operator_sessions_session_token_hash"),
        "operator_sessions",
        ["session_token_hash"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_operator_sessions_session_token_hash"), table_name="operator_sessions")
    op.drop_index(op.f("ix_operator_sessions_operator_user_id"), table_name="operator_sessions")
    op.drop_table("operator_sessions")
    op.drop_index(op.f("ix_operator_users_email"), table_name="operator_users")
    op.drop_table("operator_users")
