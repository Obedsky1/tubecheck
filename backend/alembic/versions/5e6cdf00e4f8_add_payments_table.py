
"""add_payments_table

Revision ID: 5e6cdf00e4f8
Revises: fb5bd8ba0964
Create Date: 2026-06-08 15:53:14.131855

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5e6cdf00e4f8'
down_revision: Union[str, None] = 'fb5bd8ba0964'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL so we reference the existing plan_tier enum without re-creating it
    op.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
            user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
            flutterwave_tx_id   VARCHAR(128) NOT NULL,
            flutterwave_tx_ref  VARCHAR(128) NOT NULL,
            amount          FLOAT NOT NULL,
            currency        VARCHAR(10) NOT NULL DEFAULT 'USD',
            plan_tier       plan_tier NOT NULL,
            status          VARCHAR(50) NOT NULL DEFAULT 'pending',
            flutterwave_raw JSONB,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_payments_flutterwave_tx_id ON payments (flutterwave_tx_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payments_org ON payments (org_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_payments_user_id ON payments (user_id)")


def downgrade() -> None:
    op.drop_table('payments')
