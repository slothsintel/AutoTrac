# backend/app/models.py
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Float,
    Text,
)
from sqlalchemy.orm import relationship

from .db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(320), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    time_entries = relationship("TimeEntry", back_populates="user", cascade="all, delete-orphan")
    incomes = relationship("IncomeRecord", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    name = Column(String(100), index=True, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="projects")

    time_entries = relationship(
        "TimeEntry",
        back_populates="project",
        cascade="all, delete-orphan",
    )
    incomes = relationship(
        "IncomeRecord",
        back_populates="project",
        cascade="all, delete-orphan",
    )


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    note = Column(Text, nullable=True)

    user = relationship("User", back_populates="time_entries")
    project = relationship("Project", back_populates="time_entries")


class IncomeRecord(Base):
    __tablename__ = "income_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    date = Column(DateTime, nullable=False, default=datetime.utcnow)
    amount = Column(Float, nullable=False)
    currency = Column(String(8), nullable=True)
    source = Column(String(200), nullable=True)
    note = Column(Text, nullable=True)

    user = relationship("User", back_populates="incomes")
    project = relationship("Project", back_populates="incomes")
