"""
API do Sistema de Boletins CBMMG — módulo BGBM.

Executar:  uvicorn main:app --reload  (dentro de /backend)
Front-end estático servido em /  ; API em /api/*
"""

import base64
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Any, Optional

import db
import constants

BASE = Path(__file__).parent
ASSETS = BASE / "assets"
FRONT = BASE.parent / "frontend"

app = FastAPI(title="Sistema de Boletins CBMMG", version="1.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)


@app.on_event("startup")
def _startup():
    db.init_db()


# ---------------------------------------------------------------- modelos I/O
class BGBMCreate(BaseModel):
    numero: str = Field(..., examples=["27"])
    data_publicacao: str = Field(..., examples=["09 DE JULHO DE 2026"])
    pagina_inicial: int = 1
    boletinista_pg: str = ""
    boletinista_nome: str = ""
    conteudo: Optional[dict[str, Any]] = None


class BGBMUpdate(BaseModel):
    numero: Optional[str] = None
    data_publicacao: Optional[str] = None
    pagina_inicial: Optional[int] = None
    boletinista_pg: Optional[str] = None
    boletinista_nome: Optional[str] = None
    conteudo: Optional[dict[str, Any]] = None


# ------------------------------------------------------------- metadados fixos
@app.get("/api/meta")
def meta():
    """Partes, ordem de unidades e assinaturas institucionais (base64)."""
    def b64(nome):
        p = ASSETS / nome
        if not p.exists():
            return None
        return "data:image/png;base64," + base64.b64encode(p.read_bytes()).decode()

    return {
        "partes": constants.PARTES,
        "sem_alteracao": constants.SEM_ALTERACAO,
        "ordem_unidades": constants.ORDEM_UNIDADES,
        "assets": {
            "brasao": b64("brasao.png"),
            "visto_ajudante": b64("visto_ajudante.png"),
            "assinatura_chefe_em": b64("assinatura_chefe_em.png"),
            "assinatura_ajudante": b64("assinatura_ajudante.png"),
        },
    }


@app.post("/api/unidades/ordenar")
def ordenar_unidades(payload: dict[str, list[str]]):
    """Recebe {'nomes': [...]} e devolve na ordem institucional."""
    return {"ordenadas": constants.ordenar_unidades(payload.get("nomes", []))}


# ------------------------------------------------------------------- CRUD BGBM
@app.get("/api/bgbm")
def listar():
    return db.listar_bgbm()


@app.post("/api/bgbm", status_code=201)
def criar(payload: BGBMCreate):
    return db.criar_bgbm(**payload.model_dump())


@app.get("/api/bgbm/{bgbm_id}")
def obter(bgbm_id: int):
    item = db.obter_bgbm(bgbm_id)
    if not item:
        raise HTTPException(404, "BGBM não encontrado")
    return item


@app.put("/api/bgbm/{bgbm_id}")
def atualizar(bgbm_id: int, payload: BGBMUpdate):
    item = db.atualizar_bgbm(bgbm_id, **payload.model_dump(exclude_none=True))
    if not item:
        raise HTTPException(404, "BGBM não encontrado")
    return item


@app.delete("/api/bgbm/{bgbm_id}", status_code=204)
def excluir(bgbm_id: int):
    if not db.excluir_bgbm(bgbm_id):
        raise HTTPException(404, "BGBM não encontrado")
    return None


# --------------------------------------------------------------- front estático
@app.get("/")
def index():
    return FileResponse(FRONT / "index.html")


app.mount("/assets", StaticFiles(directory=ASSETS), name="assets")
app.mount("/static", StaticFiles(directory=FRONT), name="static")
