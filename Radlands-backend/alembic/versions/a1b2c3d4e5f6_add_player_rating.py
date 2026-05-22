"""add player rating column

Revision ID: a1b2c3d4e5f6
Revises: f1a2b3c4d5e6
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'a1b2c3d4e5f6'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_cols = {c['name'] for c in inspector.get_columns('players')}

    if 'rating' not in existing_cols:
        op.add_column(
            'players',
            sa.Column('rating', sa.Integer(), nullable=False, server_default='0'),
        )


def downgrade():
    op.drop_column('players', 'rating')
