"""Add chat history limit setting

Revision ID: 004
Revises: 003
Create Date: 2026-05-14 17:00:00.000000
"""
import sqlalchemy as sa
from alembic import op

revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('app_settings', sa.Column('chat_history_limit', sa.Integer(), nullable=False, server_default='100'))
    op.execute('UPDATE app_settings SET chat_history_limit = 100 WHERE chat_history_limit IS NULL')
    op.alter_column('app_settings', 'chat_history_limit', server_default=None)


def downgrade() -> None:
    op.drop_column('app_settings', 'chat_history_limit')
