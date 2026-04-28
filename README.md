
# AutoTrac

<img src="autotrac.svg" align="right" width="180" />

[![Static Badge](https://img.shields.io/badge/License-Sloxen™-darkgreen)]()
[![Static Badge](https://img.shields.io/badge/Build-Passing-%23a9f378)]()
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)]()
[![Python](https://img.shields.io/badge/Python-3.13+-blue.svg)]()
[![Status](https://img.shields.io/badge/Project-Active-brightgreen.svg)]()

![Org](https://img.shields.io/badge/Research-Sloxen™-black)
[![Platform](https://img.shields.io/badge/Platform-Andriod%20%7C%20iOS%20%7C%20WIN%20%7C%20Linux%20%7C%20WSL%20%7C%20macOS-lightgrey)]()

**AutoTrac** is developed and maintained by **Sloxen™**, is a lightweight, mobile-first **time tracking and income tracking PWA** designed for freelancers, consultants, and small teams.
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

<div style="display:flex; overflow-x:auto; scroll-snap-type:x mandatory;">
  <img src="autotrac_screenshot_1.jpg"  style="width:100%;" />
  <img src="autotrac_screenshot_2.jpg" style="width:100%;" />
  <img src="autotrac_screenshot_3.jpg" style="width:100%;" />
  <img src="autotrac_screenshot_4.jpg" style="width:100%;" />
</div>

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
├── AutoTrac
│   └── frontend
│       ├── postcss.config.js
│       ├── src
│       ├── tsconfig.app.json
│       ├── tsconfig.node.json
│       ├── package-lock.json
│       ├── index.html
│       ├── dist
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── tailwind.config.js
│       ├── public
│       ├── package.json
│       ├── node_modules
│       ├── eslint.config.js
│       └── README.md
├── autotrac.db
├── autotrac.svg
├── requirements.txt
├── package-lock.json
└── README.md

├── backend
│   ├── __init__.py
│   ├── __pycache__
│   │   └── __init__.cpython-311.pyc
│   └── app
│       ├── __init__.py
│       ├── __pycache__
│       │   ├── __init__.cpython-311.pyc
│       │   ├── db.cpython-311.pyc
│       │   ├── main.cpython-311.pyc
│       │   ├── models.cpython-311.pyc
│       │   └── schemas.cpython-311.pyc
│       ├── db.py
│       ├── main.py
│       ├── models.py
│       └── schemas.py
├── requirements.txt
└── runtime.txt
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
git clone https://github.com/sloxen/autotrac.git
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
uvicorn backend.app.main:app --host 0.0.0.0 --port 10000
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
cd backends
git add AutoTrac
git commit -m "Deploy backend updates"
git push
```

Render automatically redeploys the backend service.

---

# Roadmap

- biometric login
- Google / Apple Stores packaging
- Team / shared projects

---

# Contribution

Maintained by [**Sloxen™ GitHub**](https://github.com/sloxen), and [**Daddy Sloth Github**](https://github.com/daddysloth).

---

# License

© 2026 **Sloxen™**.

A trading name of **Sloxen Ltd**
Registered in England and Wales (Company No. 16907507).

MIT License.

---

## Links

* [AutoTrac Website](https://autotrac.sloxen.com)
* [AutoTrac GitHub](https://github.com/sloxen/autotrac)
* [Company homepage](https://sloxen.com)

<p align="right">
  <a href="#top" style="text-decoration:none;">
    ⬆️
  </a>
</p>