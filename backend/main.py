from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from db import get_db
from models import Game, Category, Clue, Node, Edge

app = FastAPI(title="Jeopardy Brain")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/games")
def list_games(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Game).offset(skip).limit(limit).all()


@app.get("/categories")
def list_categories(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Category).offset(skip).limit(limit).all()


@app.get("/clues")
def list_clues(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Clue).offset(skip).limit(limit).all()


@app.get("/nodes")
def list_nodes(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Node).offset(skip).limit(limit).all()


@app.get("/edges")
def list_edges(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    return db.query(Edge).offset(skip).limit(limit).all()
