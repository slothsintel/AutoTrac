# backend/app/schemas.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


# ---------- Auth ----------

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ---------- Project ----------

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None


class ProjectCreate(ProjectBase):
    pass


class Project(ProjectBase):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


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
    user_id: int

    model_config = ConfigDict(from_attributes=True)


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
    user_id: int

    model_config = ConfigDict(from_attributes=True)
