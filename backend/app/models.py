# backend/app/models.py
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    Float,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    # ✅ email verification
    is_verified = Column(Boolean, nullable=False, default=False)
    verify_token = Column(String(255), nullable=True, index=True)
    verify_token_expires_at = Column(DateTime, nullable=True)

    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    time_entries = relationship("TimeEntry", back_populates="user", cascade="all, delete-orphan")
    incomes = relationship("IncomeRecord", back_populates="user", cascade="all, delete-orphan")

    reset_token = Column(String(255), nullable=True, index=True)
    reset_token_expires_at = Column(DateTime, nullable=True)



class Project(Base):
    __tablename__ = "projects"

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_projects_user_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    user = relationship("User", back_populates="projects")
    time_entries = relationship("TimeEntry", back_populates="project", cascade="all, delete-orphan")
    incomes = relationship("IncomeRecord", back_populates="project", cascade="all, delete-orphan")


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    note = Column(Text, nullable=True)

    user = relationship("User", back_populates="time_entries")
    project = relationship("Project", back_populates="time_entries")


class IncomeRecord(Base):
    __tablename__ = "income_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    date = Column(DateTime, nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, nullable=True)
    source = Column(String, nullable=True)
    note = Column(Text, nullable=True)

    user = relationship("User", back_populates="incomes")
    project = relationship("Project", back_populates="incomes")
