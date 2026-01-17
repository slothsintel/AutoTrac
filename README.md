
# AutoTrac

<img src="autotrac.svg" align="right" width="180" />

[![Static Badge](https://img.shields.io/badge/Build-Passing-%23a9f378)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)]()
[![Python](https://img.shields.io/badge/Python-3.13+-blue.svg)]()
[![Status](https://img.shields.io/badge/Project-Active-brightgreen.svg)]()

[![Static Badge](https://img.shields.io/badge/Sloths_Fin-Powered-brightgreen)]()
[![Platform](https://img.shields.io/badge/Platform-Andriod%20%7C%20iOS%20%7C%20WIN%20%7C%20Linux%20%7C%20WSL%20%7C%20macOS-lightgrey)]()

**AutoTrac** is developed and maintained by **Sloths Intel**, is a lightweight, mobile-first **time tracking and income tracking PWA** designed for freelancers, consultants, and small teams.
It focuses on **clarity, low friction, and offline-friendly workflows**, with automatic aggregation and simple financial insights.

---

# Contents
- [Features](#Features)
- [Architecture](#Architecture)
  - [Tech Stack](#Tech-Stack)
- [Local Development](#Local-Development)
  - [Clone the repository](#Clone-the-repository)
  - [Frontend (Vite)](#Frontend-Vite)       
  - [Backend (FastAPI)](#Backend-FastAPI)
- [API Overview](#API-Overview)
  - [Auth](#Auth)
  - [Projects](#Projects)
  - [Time Entries](#Time-Entries)
  - [Income](#Income)
- [Data Model](#Data-Model-Notes)
- [Build & Deploy](#Build--Deploy-Render)
  - [Frontend](#Frontend)
  - [Backend](#Backend)
- [Roadmap](#Future-Modules)
- [Contribution](#Contribution)
- [About](#About-Sloths-Fin)
- [License](#License)

---

# Features

## Time Tracking

* Start / stop time entries per project
* Manual time entry (start–end or duration)
* Project-based aggregation
* Weekly summaries (last 7 days)

## Income Tracking

* Income entries per project
* Multi-currency support
* Automatic FX conversion to GBP
* Weekly and daily income summaries

## Visual Overview

* Stacked daily time chart (last 30 days)
* Stacked daily income chart (last 30 days)
* Swipe left/right to explore history
* Charts default to **most recent data**

## Authentication

* Email + password login
* JWT-based authentication
* Per-user data isolation
* One-device token (MVP)

## PWA & UX

* Mobile-first design
* Dark mode support
* Offline-friendly frontend
* Fast refresh & background re-sync

---

# Architecture

```
autotrac/
├── frontend/          # React + Vite + TypeScript PWA
├── backend/
│   └── app/           # FastAPI backend
│       ├── main.py
│       ├── models.py
│       ├── schemas.py
│       ├── db.py
│       └── auth/
└── README.md
```

## Tech Stack

**Frontend**

* React
* TypeScript
* Vite
* Recharts
* Tailwind CSS
* PWA (Web App Manifest)

**Backend**

* FastAPI
* SQLAlchemy
* PostgreSQL
* JWT authentication
* psycopg

**Hosting**

* Frontend: Render (static site)
* Backend: Render (web service)
* Database: Render PostgreSQL

---

# Local Development

## Clone the repository

```bash
git clone https://github.com/slothsintel/autotrac.git
cd autotrac
```

---

## Frontend (Vite)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at:

```
http://localhost:5173
```

---

## Backend (FastAPI)

Create a virtual environment and install dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Linux / macOS
# .venv\Scripts\activate    # Windows

pip install -r requirements.txt
```

Set environment variables (example):

```bash
export DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/autotrac
export SECRET_KEY=dev-secret
```

Run the backend:

```bash
uvicorn app.main:app --reload
```

Backend runs at:

```
http://localhost:8000
```

Swagger UI:

```
http://localhost:8000/docs
```

---

# API Overview

## Auth

* `POST /auth/register`
* `POST /auth/login`
* `GET /auth/me`

## Projects

* `GET /projects/`
* `POST /projects/`
* `DELETE /projects/{project_id}`

## Time Entries

* `GET /time-entries/`
* `POST /time-entries/`
* `POST /time-entries/{entry_id}/stop`

## Income

* `GET /incomes/`
* `POST /incomes/`
* `DELETE /incomes/{income_id}`

---

# Data Model Notes

* Projects are **unique per user** (`(user_id, name)` constraint)
* All data is strictly user-scoped
* Cascading deletes are enabled:

  * Deleting a project deletes its time entries and income records

---

# Build & Deploy (Render)

## Frontend

```bash
cd frontend
npm run build
cd ..
git add .
git commit -m "Build frontend"
git push
```

Render automatically redeploys the frontend.

---

## Backend

```bash
git add backend
git commit -m "Deploy backend updates"
git push
```

Render automatically redeploys the backend service.

---

# Roadmap

- CSV export (time & income)
- Project archiving
- Monthly summaries
- Team / shared projects
- iOS / Android store packaging

---

# Contribution

Maintained by **Sloths Fin** of [**Sloths Intel GitHub**](https://github.com/slothsintel), and [**Daddy Sloth Github**](https://github.com/drxilu).

---

# About Sloths Fin

A financial brand under [**Sloths Intel**](https://slothsintel.com), specialising in financial technology development and financial data pipelines.

---

# License

© 2025–2026 **Sloths Intel**.

A trading name of **Sloths Intel Ltd**
Registered in England and Wales (Company No. 16907507).

MIT License.

---

## Links

* [AutoTrac Website](https://autotrac.slothsintel.com)
* [AutoTrac GitHub](https://github.com/slothsintel/autotrac)
* [Company homepage](https://slothsintel.com)

<p align="right">
  <a href="#top" style="text-decoration:none;">
    ⬆️
  </a>
</p>