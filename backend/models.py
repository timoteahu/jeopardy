from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
    String,
    Text,
    Boolean,
    Float,
    Date,
    DateTime,
    ForeignKey,
    JSON,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Game(Base):
    __tablename__ = "games"
    id = Column(BigInteger, primary_key=True)
    j_archive_id = Column(BigInteger, unique=True)
    air_date = Column(Date)
    show_number = Column(Integer)
    season = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clues = relationship("Clue", back_populates="game")


class Category(Base):
    __tablename__ = "categories"
    id = Column(BigInteger, primary_key=True)
    name = Column(Text, nullable=False)
    canonical_name = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clues = relationship("Clue", back_populates="category")


class Clue(Base):
    __tablename__ = "clues"
    id = Column(BigInteger, primary_key=True)
    game_id = Column(BigInteger, ForeignKey("games.id"))
    category_id = Column(BigInteger, ForeignKey("categories.id"))
    round = Column(String(20), nullable=False)
    value = Column(Integer)
    clue_text = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    daily_double = Column(Boolean, default=False)
    triple_stumper = Column(Boolean, default=False)
    clue_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    game = relationship("Game", back_populates="clues")
    category = relationship("Category", back_populates="clues")
    nodes = relationship("ClueNode", back_populates="clue")


class Node(Base):
    __tablename__ = "nodes"
    id = Column(BigInteger, primary_key=True)
    name = Column(Text, nullable=False)
    type = Column(Text, nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    clues = relationship("ClueNode", back_populates="node")


class Edge(Base):
    __tablename__ = "edges"
    id = Column(BigInteger, primary_key=True)
    source_node_id = Column(BigInteger, ForeignKey("nodes.id", ondelete="CASCADE"))
    target_node_id = Column(BigInteger, ForeignKey("nodes.id", ondelete="CASCADE"))
    edge_type = Column(Text, nullable=False)
    weight = Column(Float, default=1.0)
    meta = Column("metadata", JSON, default=dict)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class ClueNode(Base):
    __tablename__ = "clue_nodes"
    clue_id = Column(BigInteger, ForeignKey("clues.id", ondelete="CASCADE"), primary_key=True)
    node_id = Column(BigInteger, ForeignKey("nodes.id", ondelete="CASCADE"), primary_key=True)
    relevance = Column(Float, default=1.0)

    clue = relationship("Clue", back_populates="nodes")
    node = relationship("Node", back_populates="clues")


class Profile(Base):
    __tablename__ = "profiles"
    id = Column(UUID(as_uuid=True), primary_key=True, server_default=func.uuid_generate_v4())
    username = Column(Text, unique=True)
    email = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Attempt(Base):
    __tablename__ = "attempts"
    id = Column(BigInteger, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    clue_id = Column(BigInteger, ForeignKey("clues.id", ondelete="CASCADE"))
    correct = Column(Boolean, nullable=False)
    response_text = Column(Text)
    time_ms = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Review(Base):
    __tablename__ = "reviews"
    id = Column(BigInteger, primary_key=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("profiles.id", ondelete="CASCADE"))
    node_id = Column(BigInteger, ForeignKey("nodes.id", ondelete="CASCADE"))
    due_at = Column(DateTime(timezone=True), server_default=func.now())
    interval_days = Column(Float, default=0.0)
    ease = Column(Float, default=2.5)
    reps = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())
