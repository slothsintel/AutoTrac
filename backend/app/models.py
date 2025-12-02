from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime

from .db import Base


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, unique=True)
    client = Column(String, nullable=True)
    hourly_rate = Column(Float, nullable=True)
    notes = Column(String, nullable=True)

    time_entries = relationship("TimeEntry", back_populates="project")
    incomes = relationship("IncomeRecord", back_populates="project")


class TimeEntry(Base):
    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    note = Column(String, nullable=True)

    project = relationship("Project", back_populates="time_entries")


class IncomeRecord(Base):
    __tablename__ = "income_records"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    date = Column(DateTime, default=datetime.utcnow)
    amount = Column(Float)
    source = Column(String, nullable=True)
    note = Column(String, nullable=True)

    project = relationship("Project", back_populates="incomes")
