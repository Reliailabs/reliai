"""extend platform extensions runtime metadata

Revision ID: 20260311_0035
Revises: 20260311_0034
Create Date: 2026-03-11 16:35:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20260311_0035"
down_revision: str | None = "20260311_0034"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "platform_extensions",
        sa.Column("processor_type", sa.String(length=64), nullable=False, server_default="extension"),
    )
    op.add_column(
        "platform_extensions",
        sa.Column("version", sa.String(length=64), nullable=False, server_default="1.0.0"),
    )
    op.add_column(
        "platform_extensions",
        sa.Column("config_json", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column(
        "platform_extensions",
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("platform_extensions", "enabled")
    op.drop_column("platform_extensions", "config_json")
    op.drop_column("platform_extensions", "version")
    op.drop_column("platform_extensions", "processor_type")
