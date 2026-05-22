"""add game_challenges table

Revision ID: f1a2b3c4d5e6
Revises: d5e6f7a8b9c0
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = 'f1a2b3c4d5e6'
down_revision = 'd5e6f7a8b9c0'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)

    if 'game_challenges' not in inspector.get_table_names():
        op.create_table(
            'game_challenges',
            sa.Column('id',            sa.Integer(), primary_key=True, index=True),
            sa.Column('challenger_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=False),
            sa.Column('challenged_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=False),
            sa.Column('status',        sa.String(),  nullable=False, server_default='pending'),
            sa.Column('scheduled_at',  sa.DateTime(timezone=True), nullable=True),
            sa.Column('message',       sa.String(500), nullable=True),
            sa.Column('created_at',    sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade():
    op.drop_table('game_challenges')
