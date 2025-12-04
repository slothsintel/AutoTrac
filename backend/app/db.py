from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Use a file-based SQLite database in the backend directory
SQLALCHEMY_DATABASE_URL = "sqlite:///./autotrac.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()
