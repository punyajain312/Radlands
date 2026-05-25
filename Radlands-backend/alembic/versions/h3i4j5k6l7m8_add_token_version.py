"""add token_version to players

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-05-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'h3i4j5k6l7m8'
down_revision = 'g2h3i4j5k6l7'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('players')]
    if 'token_version' not in cols:
        op.add_column('players', sa.Column('token_version', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    op.drop_column('players', 'token_version')
