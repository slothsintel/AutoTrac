from datetime import datetime
from typing import Optional
from pydantic import BaseModel


# ---------- Project ----------

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True


# ---------- Time entry ----------

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
        orm_mode = True


# ---------- Income ----------

class IncomeBase(BaseModel):
    project_id: int
    date: datetime
    amount: float
    currency: Optional[str] = None
    source: Optional[str] = None
    note: Optional[str] = None


class IncomeCreate(IncomeBase):
    pass


class Income(IncomeBase):
    id: int

    class Config:
        orm_mode = True
