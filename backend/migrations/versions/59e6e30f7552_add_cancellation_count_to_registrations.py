"""add_cancellation_count_to_registrations

Revision ID: 59e6e30f7552
Revises: 05f9c1dd0c7b
Create Date: 2025-04-09 01:46:33.201562

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '59e6e30f7552'
down_revision = '05f9c1dd0c7b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    # Добавляем новое значение в enum
    op.execute("ALTER TYPE status ADD VALUE IF NOT EXISTS 'cancelled'")
    
    # Добавляем колонку cancellation_count
    op.add_column('registrations', sa.Column('cancellation_count', sa.Integer(), nullable=True))
    
    # Устанавливаем значение по умолчанию для существующих записей
    op.execute("UPDATE registrations SET cancellation_count = 0 WHERE cancellation_count IS NULL")
    
    # Изменяем колонку на not nullable после заполнения
    op.alter_column('registrations', 'cancellation_count', nullable=False, server_default='0')
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_column('registrations', 'cancellation_count')
    # ### end Alembic commands ### 