import os
import time

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.exc import OperationalError

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "mysql+pymysql://vac_user:vac_password@db:3306/vac_db",
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def wait_for_db(max_retries: int = 30, delay_seconds: int = 2) -> None:
    """MySQL puede tardar unos segundos en aceptar conexiones incluso
    despues de que su healthcheck pase, por eso reintentamos aqui en vez
    de que el backend se caiga al primer intento."""
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect():
                return
        except OperationalError:
            if attempt == max_retries:
                raise
            time.sleep(delay_seconds)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
