# backend/app/main.py
from __future__ import annotations

import csv
import io
import os
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models, schemas
from .db import Base, SessionLocal, engine

# create tables (NOTE: does not perform migrations; you already ran SQL migration)
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AutoTrac backend AUTH ENABLED")

# ---------------- CORS ----------------

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",

    # production frontend
    "https://autotrac.slothsintel.com",

    # Render frontend (VERY IMPORTANT)
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

SECRET_KEY = os.getenv("SECRET_KEY", "")
if not SECRET_KEY:
    # You set SECRET_KEY in Render now; keep a dev fallback to avoid local crashes.
    SECRET_KEY = "dev-secret-change-me"

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


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


# ---------------- Fingerprint (debug) ----------------

@app.get("/__whoami")
def __whoami():
    return {"loaded_from": "backend/app/main.py", "auth_expected": True}


# ---------------- Health ----------------

@app.get("/")
def root():
    return {
        "service": "AutoTrac backend",
        "status": "ok",
        "docs": "/docs",
        "time": datetime.utcnow().isoformat(),
    }


# ---------------- Auth endpoints ----------------

@app.post("/auth/register", response_model=schemas.UserPublic)
def register(body: schemas.UserCreate, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    u = models.User(email=email, password_hash=_hash_password(body.password))
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


@app.post("/auth/login", response_model=schemas.Token)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    u = db.query(models.User).filter(models.User.email == email).first()
    if not u or not _verify_password(body.password, u.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = _create_access_token(u.id)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/auth/me", response_model=schemas.UserPublic)
def me(user: models.User = Depends(get_current_user)):
    return user


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
    # prevent duplicates by name (PER USER)
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

    # children should cascade if your SQLAlchemy relationships are set to cascade.
    # Keeping explicit deletes for safety/backward compatibility:
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
        # ensure project belongs to user
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
    # ensure project exists and belongs to user
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
