"""
Camada de persistência (SQLite).

Modelo simplificado: cada BGBM é um documento único cujo conteúdo aninhado
(separatas, partes → unidades → matérias) é serializado em JSON. Isso mantém
o CRUD trivial (um boletim = uma linha) e preserva a estrutura rica das
matérias sem uma dezena de tabelas relacionais. Metadados de cabeçalho ficam
em colunas próprias para permitir listagem/ordenação eficiente.
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent / "bgbm.db"


def _conn():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    return con


def init_db():
    con = _conn()
    con.executescript(
        """
        CREATE TABLE IF NOT EXISTS bgbm (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            numero          TEXT    NOT NULL,
            data_publicacao TEXT    NOT NULL,   -- exibida no cabeçalho (texto livre)
            pagina_inicial  INTEGER NOT NULL DEFAULT 1,
            boletinista_pg  TEXT    DEFAULT '', -- posto/graduação do boletinista
            boletinista_nome TEXT   DEFAULT '',
            conteudo_json   TEXT    NOT NULL,   -- separatas + partes + unidades + matérias
            criado_em       TEXT    NOT NULL,
            atualizado_em   TEXT    NOT NULL
        );
        """
    )
    con.commit()
    con.close()


def _agora():
    return datetime.utcnow().isoformat(timespec="seconds")


def _conteudo_vazio():
    """Estrutura inicial de um BGBM: sem separatas, 4 partes vazias."""
    return {
        "separatas": [],  # [{ "titulo": str, "corpo": str(html) }]
        "partes": {
            "normativos": {"unidades": []},
            "pessoal": {"unidades": []},
            "diversos": {"unidades": []},
            "justica": {"unidades": []},
        },
        # cada unidade: { "nome": str, "materias": [materia, ...] }
        # cada materia: {
        #   "titulo": str, "subtitulo": str, "corpo": str(html),
        #   "local_data": str,
        #   "assinatura": {"nome": str, "pg": str, "funcao": str}
        # }
    }


def criar_bgbm(numero, data_publicacao, pagina_inicial=1,
               boletinista_pg="", boletinista_nome="", conteudo=None):
    con = _conn()
    ts = _agora()
    conteudo = conteudo if conteudo is not None else _conteudo_vazio()
    cur = con.execute(
        """INSERT INTO bgbm (numero, data_publicacao, pagina_inicial,
               boletinista_pg, boletinista_nome, conteudo_json, criado_em, atualizado_em)
           VALUES (?,?,?,?,?,?,?,?)""",
        (numero, data_publicacao, pagina_inicial, boletinista_pg,
         boletinista_nome, json.dumps(conteudo, ensure_ascii=False), ts, ts),
    )
    con.commit()
    novo_id = cur.lastrowid
    con.close()
    return obter_bgbm(novo_id)


def listar_bgbm():
    con = _conn()
    rows = con.execute(
        "SELECT id, numero, data_publicacao, pagina_inicial, atualizado_em "
        "FROM bgbm ORDER BY atualizado_em DESC"
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]


def obter_bgbm(bgbm_id):
    con = _conn()
    row = con.execute("SELECT * FROM bgbm WHERE id = ?", (bgbm_id,)).fetchone()
    con.close()
    if not row:
        return None
    d = dict(row)
    d["conteudo"] = json.loads(d.pop("conteudo_json"))
    return d


def atualizar_bgbm(bgbm_id, **campos):
    atual = obter_bgbm(bgbm_id)
    if not atual:
        return None
    permitidos = {
        "numero", "data_publicacao", "pagina_inicial",
        "boletinista_pg", "boletinista_nome", "conteudo",
    }
    sets, valores = [], []
    for k, v in campos.items():
        if k not in permitidos or v is None:
            continue
        if k == "conteudo":
            sets.append("conteudo_json = ?")
            valores.append(json.dumps(v, ensure_ascii=False))
        else:
            sets.append(f"{k} = ?")
            valores.append(v)
    if not sets:
        return atual
    sets.append("atualizado_em = ?")
    valores.append(_agora())
    valores.append(bgbm_id)
    con = _conn()
    con.execute(f"UPDATE bgbm SET {', '.join(sets)} WHERE id = ?", valores)
    con.commit()
    con.close()
    return obter_bgbm(bgbm_id)


def excluir_bgbm(bgbm_id):
    con = _conn()
    cur = con.execute("DELETE FROM bgbm WHERE id = ?", (bgbm_id,))
    con.commit()
    afetados = cur.rowcount
    con.close()
    return afetados > 0
