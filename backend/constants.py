"""
Constantes institucionais do BGBM/CBMMG.

Fonte: Resolução 837/2019 (Art. 5º e 6º) e "Orientações para BGBM".
NÃO alterar a ordem das listas abaixo sem respaldo normativo — a ordem das
unidades e das partes é imposta pela regra de confecção do boletim.
"""

# As 4 partes fixas do BGBM (Art. 5º da Res. 837/2019), na ordem obrigatória.
PARTES = [
    {"id": "normativos", "ordem": 1, "titulo": "PRIMEIRA - PARTE", "subtitulo": "ASSUNTOS NORMATIVOS"},
    {"id": "pessoal", "ordem": 2, "titulo": "SEGUNDA - PARTE", "subtitulo": "ASSUNTOS DE PESSOAL"},
    {"id": "diversos", "ordem": 3, "titulo": "TERCEIRA - PARTE", "subtitulo": "ASSUNTOS DIVERSOS"},
    {"id": "justica", "ordem": 4, "titulo": "QUARTA - PARTE", "subtitulo": "JUSTIÇA E DISCIPLINA"},
]

# Texto exibido quando uma parte não possui matérias.
SEM_ALTERACAO = "SEM ALTERAÇÃO"

# Ordem canônica das unidades dentro de cada parte (item 2.4 das Orientações).
# O índice nesta lista determina a posição de exibição; unidades fora da lista
# vão para o fim, em ordem alfabética, sem quebrar as conhecidas.
ORDEM_UNIDADES = [
    "CG",
    "EMBM",
    "Aud. Setorial",
    "CCBM",
    "EMBM1",
    "EMBM2",
    "EMBM3",
    "EMBM4",
    "EMBM5",
    "DRH",
    "DAT",
    "DLF",
    "DAI",
    "ABM",
    "AAS",
    "CEB",
    "1º COB",
    "2º COB",
    "3º COB",
    "4º COB",
    "5º COB",
    "6º COB",
    "Aj. Geral",
    "CSM",
    "CAT",
    "COBOM",
    "1º BBM",
    "2º BBM",
    "3º BBM",
    "4º BBM",
    "5º BBM",
    "6º BBM",
    "7º BBM",
    "8º BBM",
    "9º BBM",
    "10º BBM",
    "11º BBM",
    "12º BBM",
    "1ª CIA IND",
    "2ª CIA IND",
    "5ª CIA IND",
    "6ª CIA IND",
    "7ª CIA IND",
]

# Índice de ordenação para consulta rápida.
_ORDEM_INDEX = {nome: i for i, nome in enumerate(ORDEM_UNIDADES)}


def indice_unidade(nome: str) -> int:
    """Posição de ordenação da unidade. Desconhecidas recebem um índice alto
    para caírem após todas as unidades canônicas."""
    return _ORDEM_INDEX.get(nome.strip(), len(ORDEM_UNIDADES) + 1)


def ordenar_unidades(nomes):
    """Ordena uma coleção de nomes de unidade pela ordem institucional,
    desconhecidas ao final em ordem alfabética."""
    conhecidas = [n for n in nomes if n.strip() in _ORDEM_INDEX]
    desconhecidas = sorted(n for n in nomes if n.strip() not in _ORDEM_INDEX)
    conhecidas.sort(key=lambda n: _ORDEM_INDEX[n.strip()])
    return conhecidas + desconhecidas
