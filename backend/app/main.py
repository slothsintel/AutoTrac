from datetime import datetime
from typing import Optional

import csv
import io
from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .db import Base, engine, SessionLocal
from . import models, schemas

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AutoTrac")

# CORS for local dev; you can tighten later
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- Projects ---


@app.post("/projects/", response_model=schemas.Project)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    db_project = models.Project(**project.dict())
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


@app.get("/projects/", response_model=list[schemas.Project])
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).all()


# --- Time entries ---


@app.post("/time-entries/", response_model=schemas.TimeEntry)
def create_time_entry(entry: schemas.TimeEntryCreate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter_by(id=entry.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db_entry = models.TimeEntry(
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
def stop_time_entry(entry_id: int, db: Session = Depends(get_db)):
    """Set end_time=now for a running entry."""
    entry = db.query(models.TimeEntry).filter_by(id=entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")
    if entry.end_time:
        return entry
    entry.end_time = datetime.utcnow()
    db.commit()
    db.refresh(entry)
    return entry


@app.get("/time-entries/", response_model=list[schemas.TimeEntry])
def list_time_entries(
    project_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.TimeEntry)
    if project_id is not None:
        q = q.filter(models.TimeEntry.project_id == project_id)
    if date_from is not None:
        q = q.filter(models.TimeEntry.start_time >= date_from)
    if date_to is not None:
        q = q.filter(models.TimeEntry.start_time <= date_to)
    return q.order_by(models.TimeEntry.start_time.desc()).all()


# --- Income records ---


@app.post("/incomes/", response_model=schemas.Income)
def create_income(income: schemas.IncomeCreate, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter_by(id=income.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db_income = models.IncomeRecord(**income.dict())
    db.add(db_income)
    db.commit()
    db.refresh(db_income)
    return db_income


@app.get("/incomes/", response_model=list[schemas.Income])
def list_incomes(
    project_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.IncomeRecord)
    if project_id is not None:
        q = q.filter(models.IncomeRecord.project_id == project_id)
    if date_from is not None:
        q = q.filter(models.IncomeRecord.date >= date_from)
    if date_to is not None:
        q = q.filter(models.IncomeRecord.date <= date_to)
    return q.order_by(models.IncomeRecord.date.desc()).all()


# --- Per-project summary ---


@app.get("/projects/{project_id}/summary", response_model=schemas.ProjectSummary)
def project_summary(
    project_id: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter_by(id=project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    time_q = db.query(models.TimeEntry).filter_by(project_id=project_id)
    income_q = db.query(models.IncomeRecord).filter_by(project_id=project_id)

    if date_from is not None:
        time_q = time_q.filter(models.TimeEntry.start_time >= date_from)
        income_q = income_q.filter(models.IncomeRecord.date >= date_from)
    if date_to is not None:
        time_q = time_q.filter(models.TimeEntry.start_time <= date_to)
        income_q = income_q.filter(models.IncomeRecord.date <= date_to)

    time_entries = time_q.all()
    incomes = income_q.all()

    total_minutes = 0.0
    for e in time_entries:
        if e.end_time:
            delta = e.end_time - e.start_time
        else:
            delta = datetime.utcnow() - e.start_time
        total_minutes += delta.total_seconds() / 60

    total_income = sum(i.amount for i in incomes)
    eff_rate = None
    if total_minutes > 0:
        eff_rate = total_income / (total_minutes / 60)

    return schemas.ProjectSummary(
        project=project,
        total_minutes=total_minutes,
        total_income=total_income,
        effective_hourly_rate=eff_rate,
    )


# --- CSV export ---


@app.get("/projects/{project_id}/export/time.csv")
def export_time_csv(
    project_id: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.TimeEntry).filter_by(project_id=project_id)
    if date_from is not None:
        q = q.filter(models.TimeEntry.start_time >= date_from)
    if date_to is not None:
        q = q.filter(models.TimeEntry.start_time <= date_to)
    entries = q.order_by(models.TimeEntry.start_time.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "project_id", "start_time", "end_time", "note", "duration_minutes"])
    for e in entries:
        end_time = e.end_time or datetime.utcnow()
        duration_min = (end_time - e.start_time).total_seconds() / 60
        writer.writerow(
            [
                e.id,
                e.project_id,
                e.start_time.isoformat(),
                e.end_time.isoformat() if e.end_time else "",
                e.note or "",
                f"{duration_min:.2f}",
            ]
        )

    csv_content = output.getvalue()
    filename = f"project_{project_id}_time_entries.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/projects/{project_id}/export/incomes.csv")
def export_incomes_csv(
    project_id: int,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.IncomeRecord).filter_by(project_id=project_id)
    if date_from is not None:
        q = q.filter(models.IncomeRecord.date >= date_from)
    if date_to is not None:
        q = q.filter(models.IncomeRecord.date <= date_to)
    incomes = q.order_by(models.IncomeRecord.date.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "project_id", "date", "amount", "source", "note"])
    for inc in incomes:
        writer.writerow(
            [
                inc.id,
                inc.project_id,
                inc.date.isoformat(),
                f"{inc.amount:.2f}",
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
