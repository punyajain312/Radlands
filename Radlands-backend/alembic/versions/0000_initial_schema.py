"""initial schema — create players and games tables

Revision ID: 0000_initial_schema
Revises:
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

revision = '0000_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'players' not in existing_tables:
        op.create_table(
            'players',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('username', sa.String(), nullable=False, unique=True),
            sa.Column('email', sa.String(), nullable=False, unique=True),
            sa.Column('password', sa.String(), nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )

    if 'games' not in existing_tables:
        op.create_table(
            'games',
            sa.Column('id', sa.Integer(), primary_key=True, index=True),
            sa.Column('player1_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=False),
            sa.Column('player2_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=False),
            sa.Column('status', sa.String(), server_default='waiting'),
            sa.Column('start_player_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=True),
            sa.Column('current_turn_player_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=True),
            sa.Column('turn_number', sa.Integer(), server_default='1'),
            sa.Column('winner_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )


def downgrade():
    op.drop_table('games')
    op.drop_table('players')
