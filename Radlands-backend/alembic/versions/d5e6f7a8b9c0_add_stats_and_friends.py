"""add player stats and friend requests

Revision ID: d5e6f7a8b9c0
Revises: c03fb26cb947
Create Date: 2026-05-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'c03fb26cb947'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_player_cols = {c['name'] for c in inspector.get_columns('players')}

    if 'games_played' not in existing_player_cols:
        op.add_column('players', sa.Column('games_played', sa.Integer(), nullable=False, server_default='0'))
    if 'games_won' not in existing_player_cols:
        op.add_column('players', sa.Column('games_won', sa.Integer(), nullable=False, server_default='0'))
    if 'games_lost' not in existing_player_cols:
        op.add_column('players', sa.Column('games_lost', sa.Integer(), nullable=False, server_default='0'))
    if 'card_play_counts' not in existing_player_cols:
        op.add_column('players', sa.Column('card_play_counts', sa.JSON(), nullable=True))

    existing_tables = inspector.get_table_names()
    if 'friend_requests' not in existing_tables:
        op.create_table(
            'friend_requests',
            sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
            sa.Column('sender_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=False),
            sa.Column('receiver_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=False),
            sa.Column('status', sa.String(), nullable=False, server_default='pending'),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.UniqueConstraint('sender_id', 'receiver_id', name='uq_friend_request'),
        )

    existing_indexes = {idx['name'] for idx in inspector.get_indexes('friend_requests')} if 'friend_requests' in inspector.get_table_names() else set()
    if 'ix_friend_requests_receiver_id' not in existing_indexes:
        op.create_index('ix_friend_requests_receiver_id', 'friend_requests', ['receiver_id'])
    if 'ix_friend_requests_sender_id' not in existing_indexes:
        op.create_index('ix_friend_requests_sender_id', 'friend_requests', ['sender_id'])


def downgrade() -> None:
    op.drop_index('ix_friend_requests_receiver_id', table_name='friend_requests')
    op.drop_index('ix_friend_requests_sender_id', table_name='friend_requests')
    op.drop_table('friend_requests')
    op.drop_column('players', 'card_play_counts')
    op.drop_column('players', 'games_lost')
    op.drop_column('players', 'games_won')
    op.drop_column('players', 'games_played')
