# backend/app/main.py
from __future__ import annotations

import csv
import io
import os
import secrets
import smtplib
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models, schemas
from .db import Base, SessionLocal, engine

# create tables (NOTE: does not perform migrations)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AutoTrac backend AUTH ENABLED")

# ---------------- CORS ----------------

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://autotrac.slothsintel.com",
    "https://autotrac-35sx.onrender.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------- DB dependency ----------------

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------------- Auth config ----------------

SECRET_KEY = os.getenv("SECRET_KEY", "") or "dev-secret-change-me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
RESET_TTL_HOURS = int(os.getenv("RESET_TTL_HOURS", "1"))


def _hash_password(p: str) -> str:
    return pwd_context.hash(p)


def _verify_password(p: str, phash: str) -> bool:
    return pwd_context.verify(p, phash)


def _create_access_token(user_id: int) -> str:
    exp = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": exp}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = int(sub)
    except (JWTError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

def make_reset_token() -> str:
    return secrets.token_urlsafe(32)

def send_reset_email(to_email: str, token: str) -> None:
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    email_from = os.getenv("EMAIL_FROM", smtp_user) or smtp_user

    if not (smtp_host and smtp_user and smtp_pass):
        raise RuntimeError("SMTP not configured (SMTP_HOST/USER/PASS missing)")

    link = f"{PUBLIC_APP_URL.rstrip('/')}/reset-password?token={token}"

    msg = EmailMessage()
    msg["Subject"] = "Reset your AutoTrac password"
    msg["From"] = email_from
    msg["To"] = to_email
    msg["Reply-To"] = email_from
    msg.set_content(
        "We received a request to reset your AutoTrac password.\n\n"
        "Open this link to set a new password:\n"
        f"{link}\n\n"
        f"This link expires in {RESET_TTL_HOURS} hour(s).\n\n"
        "If you didn’t request this, you can ignore this email or report to us (mailto:info@slothsintel.com).\n"
        "— Sloths Intel\n"
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as s:
        s.ehlo()
        s.starttls()
        s.ehlo()
        s.login(smtp_user, smtp_pass)
        s.send_message(msg)



# ---------------- Health ----------------

@app.get("/")
def root():
    return {
        "service": "AutoTrac backend",
        "status": "ok",
        "docs": "/docs",
        "time": datetime.utcnow().isoformat(),
    }


# ---------------- Email verification helpers ----------------

VERIFY_TTL_HOURS = int(os.getenv("VERIFY_TTL_HOURS", "24"))
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "https://autotrac.slothsintel.com")

def _make_verify_token() -> str:
    return secrets.token_urlsafe(32)

def _send_verify_email(to_email: str, token: str) -> None:
    smtp_host = os.getenv("SMTP_HOST", "")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    email_from = os.getenv("EMAIL_FROM", smtp_user) or smtp_user

    if not (smtp_host and smtp_user and smtp_pass):
        raise RuntimeError("SMTP not configured (SMTP_HOST/USER/PASS missing)")

    link = f"{PUBLIC_APP_URL.rstrip('/')}/verify?token={token}"

    msg = EmailMessage()
    msg["Subject"] = "Confirm your AutoTrac account"
    msg["From"] = email_from
    msg["To"] = to_email
    msg["Reply-To"] = email_from

    msg.set_content(
        "Welcome to AutoTrac!\n\n"
        "Please confirm your email address by opening this link:\n"
        f"{link}\n\n"
        f"This link expires in {VERIFY_TTL_HOURS} hours.\n\n"
        "— Sloths Intel\n"
    )

    with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as s:
        s.ehlo()
        s.starttls()
        s.ehlo()
        s.login(smtp_user, smtp_pass)
        s.send_message(msg)


# ---------------- Auth endpoints ----------------

@app.post("/auth/register", response_model=schemas.UserPublic)
def register(body: schemas.UserCreate, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    token = _make_verify_token()
    expires = datetime.utcnow() + timedelta(hours=VERIFY_TTL_HOURS)

    u = models.User(
        email=email,
        password_hash=_hash_password(body.password),
        is_verified=False,
        verify_token=token,
        verify_token_expires_at=expires,
    )
    db.add(u)
    db.commit()
    db.refresh(u)

    # send email AFTER commit so the user exists even if email fails
    try:
        _send_verify_email(email, token)
        print(f"[email] verify email sent to {email}")
    except Exception as e:
        # Keep registration successful (minimal disruption), but log loudly
        print(f"[email] failed to send verify email to {email}: {e}")

    return u


@app.get("/auth/verify", response_model=schemas.VerifyResult)
def verify_email(token: str, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.verify_token == token).first()
    if not u:
        raise HTTPException(status_code=400, detail="Invalid verification token")

    if u.is_verified:
        # already verified; make it idempotent
        return {"ok": True}

    if u.verify_token_expires_at and datetime.utcnow() > u.verify_token_expires_at:
        raise HTTPException(status_code=400, detail="Verification token expired")

    u.is_verified = True
    u.verify_token = None
    u.verify_token_expires_at = None
    db.commit()

    return {"ok": True}


@app.post("/auth/login", response_model=schemas.Token)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    u = db.query(models.User).filter(models.User.email == email).first()
    if not u or not _verify_password(body.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not u.is_verified:
        raise HTTPException(status_code=403, detail="Please verify your email before logging in")

    token = _create_access_token(u.id)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserPublic)
def me(user: models.User = Depends(get_current_user)):
    return user

@app.post("/auth/forgot-password", response_model=schemas.OkResult)
def forgot_password(body: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    u = db.query(models.User).filter(models.User.email == email).first()

    # Always return ok (prevents revealing whether an email exists)
    if not u:
        return {"ok": True}

    token = make_reset_token()
    expires = datetime.utcnow() + timedelta(hours=RESET_TTL_HOURS)

    u.reset_token = token
    u.reset_token_expires_at = expires
    db.commit()

    try:
        send_reset_email(email, token)
        print(f"[email] reset email sent to {email}")
    except Exception as e:
        print(f"[email] failed to send reset email to {email}: {e}")

    return {"ok": True}

@app.post("/auth/forgot-password", response_model=schemas.OkResult)
def forgot_password(body: schemas.ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    u = db.query(models.User).filter(models.User.email == email).first()

    # Always return ok (prevents revealing whether an email exists)
    if not u:
        return {"ok": True}

    token = make_reset_token()
    expires = datetime.utcnow() + timedelta(hours=RESET_TTL_HOURS)

    u.reset_token = token
    u.reset_token_expires_at = expires
    db.commit()

    try:
        send_reset_email(email, token)
        print(f"[email] reset email sent to {email}")
    except Exception as e:
        print(f"[email] failed to send reset email to {email}: {e}")

    return {"ok": True}

@app.post("/auth/reset-password", response_model=schemas.OkResult)
def reset_password(body: schemas.ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    u = db.query(models.User).filter(models.User.reset_token == body.token).first()
    if not u:
        raise HTTPException(status_code=400, detail="Invalid reset token")

    if u.reset_token_expires_at and datetime.utcnow() > u.reset_token_expires_at:
        raise HTTPException(status_code=400, detail="Reset token expired")

    u.password_hash = _hash_password(body.new_password)
    u.reset_token = None
    u.reset_token_expires_at = None
    db.commit()

    return {"ok": True}

# ---------------- Projects ----------------

@app.get("/projects/", response_model=List[schemas.Project])
def list_projects(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.Project)
        .filter(models.Project.user_id == user.id)
        .order_by(models.Project.id.asc())
        .all()
    )


@app.post("/projects/", response_model=schemas.Project)
def create_project(
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    existing = (
        db.query(models.Project)
        .filter(models.Project.user_id == user.id)
        .filter(models.Project.name == project.name)
        .first()
    )
    if existing:
        return existing

    db_project = models.Project(
        user_id=user.id,
        name=project.name,
        description=project.description,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@app.delete("/projects/{project_id}/")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    proj = (
        db.query(models.Project)
        .filter(models.Project.id == project_id)
        .filter(models.Project.user_id == user.id)
        .first()
    )
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    db.query(models.TimeEntry).filter(
        models.TimeEntry.project_id == project_id,
        models.TimeEntry.user_id == user.id,
    ).delete()

    db.query(models.IncomeRecord).filter(
        models.IncomeRecord.project_id == project_id,
        models.IncomeRecord.user_id == user.id,
    ).delete()

    db.delete(proj)
    db.commit()
    return {"ok": True, "deleted_project_id": project_id}


# ---------------- Time entries ----------------

@app.get("/time-entries/", response_model=List[schemas.TimeEntry])
def list_time_entries(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    q = db.query(models.TimeEntry).filter(models.TimeEntry.user_id == user.id)

    if project_id is not None:
        proj = (
            db.query(models.Project)
            .filter(models.Project.id == project_id)
            .filter(models.Project.user_id == user.id)
            .first()
        )
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        q = q.filter(models.TimeEntry.project_id == project_id)

    return q.order_by(models.TimeEntry.start_time.desc()).all()


@app.post("/time-entries/", response_model=schemas.TimeEntry)
def create_time_entry(
    entry: schemas.TimeEntryCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    project = (
        db.query(models.Project)
        .filter(models.Project.id == entry.project_id)
        .filter(models.Project.user_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db_entry = models.TimeEntry(
        user_id=user.id,
        project_id=entry.project_id,
        start_time=entry.start_time,
        end_time=entry.end_time,
        note=entry.note,
    )
    db.add(db_entry)
    db.commit()
    db.refresh(db_entry)
    return db_entry


@app.post("/time-entries/{entry_id}/stop", response_model=schemas.TimeEntry)
def stop_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    entry = (
        db.query(models.TimeEntry)
        .filter(models.TimeEntry.id == entry_id)
        .filter(models.TimeEntry.user_id == user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    if entry.end_time is None:
        entry.end_time = datetime.utcnow()
        db.commit()
        db.refresh(entry)

    return entry


@app.delete("/time-entries/{entry_id}/")
def delete_time_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    obj = (
        db.query(models.TimeEntry)
        .filter(models.TimeEntry.id == entry_id)
        .filter(models.TimeEntry.user_id == user.id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Time entry not found")

    db.delete(obj)
    db.commit()
    return {"ok": True, "deleted_time_entry_id": entry_id}


# ---------------- Incomes ----------------

@app.get("/incomes/", response_model=List[schemas.Income])
def list_incomes(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    q = db.query(models.IncomeRecord).filter(models.IncomeRecord.user_id == user.id)

    if project_id is not None:
        proj = (
            db.query(models.Project)
            .filter(models.Project.id == project_id)
            .filter(models.Project.user_id == user.id)
            .first()
        )
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        q = q.filter(models.IncomeRecord.project_id == project_id)

    return q.order_by(models.IncomeRecord.date.desc()).all()


@app.post("/incomes/", response_model=schemas.Income)
def create_income(
    income: schemas.IncomeCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    project = (
        db.query(models.Project)
        .filter(models.Project.id == income.project_id)
        .filter(models.Project.user_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db_income = models.IncomeRecord(
        user_id=user.id,
        project_id=income.project_id,
        date=income.date,
        amount=income.amount,
        currency=income.currency,
        source=income.source,
        note=income.note,
    )
    db.add(db_income)
    db.commit()
    db.refresh(db_income)
    return db_income


@app.delete("/incomes/{income_id}/")
def delete_income(
    income_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    obj = (
        db.query(models.IncomeRecord)
        .filter(models.IncomeRecord.id == income_id)
        .filter(models.IncomeRecord.user_id == user.id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Income not found")

    db.delete(obj)
    db.commit()
    return {"ok": True, "deleted_income_id": income_id}


# ---------------- CSV export ----------------

@app.get("/projects/{project_id}/incomes/export")
def export_project_incomes_csv(
    project_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    project = (
        db.query(models.Project)
        .filter(models.Project.id == project_id)
        .filter(models.Project.user_id == user.id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    incomes = (
        db.query(models.IncomeRecord)
        .filter(models.IncomeRecord.project_id == project_id)
        .filter(models.IncomeRecord.user_id == user.id)
        .order_by(models.IncomeRecord.date.asc())
        .all()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "amount", "currency", "source", "note"])

    for inc in incomes:
        writer.writerow(
            [
                inc.date.isoformat(),
                f"{inc.amount:.2f}",
                inc.currency or "",
                inc.source or "",
                inc.note or "",
            ]
        )

    csv_content = output.getvalue()
    filename = f"project_{project_id}_incomes.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
