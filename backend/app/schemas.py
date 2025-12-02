from datetime import datetime
from pydantic import BaseModel
from typing import Optional


class TimeEntryBase(BaseModel):
    project_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    note: Optional[str] = None


class TimeEntryCreate(TimeEntryBase):
    pass


class TimeEntry(TimeEntryBase):
    id: int

    class Config:
        from_attributes = True


class IncomeBase(BaseModel):
    project_id: int
    date: datetime
    amount: float
    source: Optional[str] = None
    note: Optional[str] = None


class IncomeCreate(IncomeBase):
    pass


class Income(IncomeBase):
    id: int

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    name: str
    client: Optional[str] = None
    hourly_rate: Optional[float] = None
    notes: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    id: int

    class Config:
        from_attributes = True


class ProjectSummary(BaseModel):
    project: Project
    total_minutes: float
    total_income: float
    effective_hourly_rate: Optional[float]
