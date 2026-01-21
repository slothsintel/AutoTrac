# backend/app/schemas.py
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


# ---------------- Auth ----------------

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class OkResult(BaseModel):
    ok: bool


class UserPublic(BaseModel):
    id: int
    email: EmailStr
    created_at: datetime
    is_verified: bool  # ✅ handy for debugging /auth/me

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyResult(BaseModel):
    ok: bool


# ---------------- Projects ----------------

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None


class Project(ProjectCreate):
    id: int
    user_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------- Time Entries ----------------

class TimeEntryCreate(BaseModel):
    project_id: int
    start_time: datetime
    end_time: Optional[datetime] = None
    note: Optional[str] = None


class TimeEntry(TimeEntryCreate):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)


# ---------------- Incomes ----------------

class IncomeCreate(BaseModel):
    project_id: int
    date: datetime
    amount: float
    currency: Optional[str] = None
    source: Optional[str] = None
    note: Optional[str] = None


class Income(IncomeCreate):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)
