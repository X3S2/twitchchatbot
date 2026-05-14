"""Add refresh token columns for bot authentication

Revision ID: 003
Revises: 002
Create Date: 2025-01-01 00:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('app_settings', sa.Column('bot_refresh_token_enc', sa.Text(), nullable=True))
    op.add_column('tenants', sa.Column('own_bot_refresh_token_enc', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('app_settings', 'bot_refresh_token_enc')
    op.drop_column('tenants', 'own_bot_refresh_token_enc')
