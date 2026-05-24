"""add username_changed_at to players

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2026-05-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'g2h3i4j5k6l7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    cols = [c['name'] for c in inspector.get_columns('players')]
    if 'username_changed_at' not in cols:
        op.add_column('players', sa.Column('username_changed_at', sa.DateTime(timezone=True), nullable=True))


def downgrade():
    op.drop_column('players', 'username_changed_at')
