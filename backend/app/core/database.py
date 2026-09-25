from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

# Configure database engine
connect_args = {}
db_url = settings.DATABASE_URL or ""

# 1. Normalize Railway postgres dialect (postgres:// -> postgresql://)
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# Ensure compatible driver prefix for SQLAlchemy (supports both psycopg v3 and psycopg2)
if db_url.startswith("postgresql://"):
    try:
        import psycopg
        db_url = db_url.replace("postgresql://", "postgresql+psycopg://", 1)
    except ImportError:
        try:
            import psycopg2
            db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        except ImportError:
            pass

# 2. Resilient local fallback if Railway template variable is unexpanded or invalid outside Railway runtime
if not db_url or "://" not in db_url or db_url.startswith("${{"):
    db_url = "sqlite:///./praxirence_dev.db"

engine_kwargs = {"pool_pre_ping": True}
if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # Production PostgreSQL connection pool configuration
    engine_kwargs.update({
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800,
        "pool_timeout": 30,
    })

engine = create_engine(
    db_url,
    connect_args=connect_args,
    **engine_kwargs
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
