"""organization invitations persistence

Adds pending organization invitation persistence so Pulse can surface and revoke
queued invites for teammates who do not yet have an account.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260521_0001"
down_revision: str | Sequence[str] | None = "20260514_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "organization_invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("organization_id", sa.Uuid(), nullable=False),
        sa.Column("invited_email", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("invited_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("token", sa.String(length=128), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["invited_by_user_id"],
            ["users.id"],
            name=op.f("fk_organization_invitations_invited_by_user_id_users"),
        ),
        sa.ForeignKeyConstraint(
            ["organization_id"],
            ["organizations.id"],
            name=op.f("fk_organization_invitations_organization_id_organizations"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_organization_invitations")),
        sa.UniqueConstraint("token", name="uq_organization_invitations_token"),
    )
    op.create_index(
        op.f("ix_organization_invitations_organization_id"),
        "organization_invitations",
        ["organization_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_invitations_invited_email"),
        "organization_invitations",
        ["invited_email"],
        unique=False,
    )
    op.create_index(
        "ix_organization_invitations_organization_email",
        "organization_invitations",
        ["organization_id", "invited_email"],
        unique=False,
    )
    op.create_index(
        op.f("ix_organization_invitations_invited_by_user_id"),
        "organization_invitations",
        ["invited_by_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_organization_invitations_invited_by_user_id"), table_name="organization_invitations")
    op.drop_index("ix_organization_invitations_organization_email", table_name="organization_invitations")
    op.drop_index(op.f("ix_organization_invitations_invited_email"), table_name="organization_invitations")
    op.drop_index(op.f("ix_organization_invitations_organization_id"), table_name="organization_invitations")
    op.drop_table("organization_invitations")
