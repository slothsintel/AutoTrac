from datetime import datetime
from typing import List, Optional

import csv
import io
from fastapi import FastAPI, Depends, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fastapi import HTTPException

from .db import Base, engine, SessionLocal
from . import models, schemas

# create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AutoTrac backend")

# ---------------- CORS ----------------

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://autotrac.slothsintel.com",
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


# ---------------- Health ----------------

@app.get("/")
def root():
    return {
        "service": "AutoTrac backend",
        "status": "ok",
        "docs": "/docs",
        "time": datetime.utcnow().isoformat(),
    }


# ---------------- Projects ----------------

@app.get("/projects/", response_model=List[schemas.Project])
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).order_by(models.Project.id.asc()).all()


@app.post("/projects/", response_model=schemas.Project)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db)):
    # prevent duplicates by name
    existing = (
        db.query(models.Project)
        .filter(models.Project.name == project.name)
        .first()
    )
    if existing:
        return existing

    db_project = models.Project(
        name=project.name,
        description=project.description,
    )
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project


# ---------------- Time entries ----------------

@app.get("/time-entries/", response_model=List[schemas.TimeEntry])
def list_time_entries(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.TimeEntry)
    if project_id is not None:
        q = q.filter(models.TimeEntry.project_id == project_id)
    return q.order_by(models.TimeEntry.start_time.desc()).all()


@app.post("/time-entries/", response_model=schemas.TimeEntry)
def create_time_entry(
    entry: schemas.TimeEntryCreate,
    db: Session = Depends(get_db),
):
    # ensure project exists
    project = db.query(models.Project).filter(
        models.Project.id == entry.project_id
    ).first()
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
    entry = (
        db.query(models.TimeEntry)
        .filter(models.TimeEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Time entry not found")

    if entry.end_time is None:
        entry.end_time = datetime.utcnow()
        db.commit()
        db.refresh(entry)

    return entry


# ---------------- Incomes ----------------

@app.get("/incomes/", response_model=List[schemas.Income])
def list_incomes(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    q = db.query(models.IncomeRecord)
    if project_id is not None:
        q = q.filter(models.IncomeRecord.project_id == project_id)
    return q.order_by(models.IncomeRecord.date.desc()).all()


@app.post("/incomes/", response_model=schemas.Income)
def create_income(
    income: schemas.IncomeCreate,
    db: Session = Depends(get_db),
):
    project = db.query(models.Project).filter(
        models.Project.id == income.project_id
    ).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    db_income = models.IncomeRecord(
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


# ---------------- CSV export (optional) ----------------

@app.get("/projects/{project_id}/incomes/export")
def export_project_incomes_csv(
    project_id: int,
    db: Session = Depends(get_db),
):
    project = (
        db.query(models.Project)
        .filter(models.Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    incomes = (
        db.query(models.IncomeRecord)
        .filter(models.IncomeRecord.project_id == project_id)
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

@app.delete("/incomes/{income_id}/")
def delete_income(income_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.IncomeRecord).filter(models.IncomeRecord.id == income_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Income not found")
    db.delete(obj)
    db.commit()
    return {"ok": True, "deleted_income_id": income_id}

@app.delete("/time-entries/{entry_id}/")
def delete_time_entry(entry_id: int, db: Session = Depends(get_db)):
    obj = db.query(models.TimeEntry).filter(models.TimeEntry.id == entry_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Time entry not found")
    db.delete(obj)
    db.commit()
    return {"ok": True, "deleted_time_entry_id": entry_id}

@app.delete("/projects/{project_id}/")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    proj = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    # delete children first (safe if you don't have cascade configured)
    db.query(models.TimeEntry).filter(models.TimeEntry.project_id == project_id).delete()
    db.query(models.IncomeRecord).filter(models.IncomeRecord.project_id == project_id).delete()

    db.delete(proj)
    db.commit()
    return {"ok": True, "deleted_project_id": project_id}

