"""add player stats and friend requests

Revision ID: d5e6f7a8b9c0
Revises: c03fb26cb947
Create Date: 2026-05-22 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5e6f7a8b9c0'
down_revision: Union[str, Sequence[str], None] = 'c03fb26cb947'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('players', sa.Column('games_played', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('players', sa.Column('games_won', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('players', sa.Column('games_lost', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('players', sa.Column('card_play_counts', sa.JSON(), nullable=True))

    op.create_table(
        'friend_requests',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('sender_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=False),
        sa.Column('receiver_id', sa.Integer(), sa.ForeignKey('players.id'), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('sender_id', 'receiver_id', name='uq_friend_request'),
    )
    op.create_index('ix_friend_requests_receiver_id', 'friend_requests', ['receiver_id'])
    op.create_index('ix_friend_requests_sender_id', 'friend_requests', ['sender_id'])


def downgrade() -> None:
    op.drop_index('ix_friend_requests_receiver_id', table_name='friend_requests')
    op.drop_index('ix_friend_requests_sender_id', table_name='friend_requests')
    op.drop_table('friend_requests')
    op.drop_column('players', 'card_play_counts')
    op.drop_column('players', 'games_lost')
    op.drop_column('players', 'games_won')
    op.drop_column('players', 'games_played')
