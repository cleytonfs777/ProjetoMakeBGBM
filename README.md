# Sistema de Boletins CBMMG — Módulo BGBM

Ferramenta web para **compor, gerenciar e exportar** o Boletim Geral do Corpo de
Bombeiros Militar (BGBM) em PDF, seguindo a formatação oficial da Resolução
837/2019 e o manual de confecção do boletinista.

Este é o **primeiro módulo** de um sistema maior de boletins (a barra lateral já
prevê SEPARATAS, BEBM, BI, BT e Diário Oficial, a serem desenvolvidos).

---

## Stack

| Camada    | Tecnologia                                    |
|-----------|-----------------------------------------------|
| Backend   | Python 3 + **FastAPI**                        |
| Banco     | **SQLite** (arquivo `backend/bgbm.db`, criado automaticamente) |
| Front-end | HTML + CSS + JavaScript puro (sem build)      |
| Exportação PDF | `window.print()` + CSS `@media print` (Salvar como PDF do navegador) |

Sem dependências de front-end e sem etapa de build — o front é servido
diretamente pelo FastAPI.

---

## Como executar

```bash
cd backend
pip install fastapi "uvicorn[standard]"
uvicorn main:app --reload
```

Acesse **http://127.0.0.1:8000**

O banco `bgbm.db` e as tabelas são criados sozinhos na primeira execução.

---

## Como usar

1. **+ Novo BGBM** — informe número, data de publicação e página inicial.
2. No editor:
   - **Cabeçalho / Boletinista** — dados que aparecem no topo e no rodapé.
   - **Separatas** — blocos opcionais "Está sendo publicado em separata"
     (título obrigatório, corpo opcional; quantos blocos quiser).
   - **Estrutura** — as 4 partes fixas do BGBM. Em cada parte:
     - **＋ un.** adiciona uma unidade (entra automaticamente na ordem
       institucional correta — CG, EMBM, … BBMs, CIA IND).
     - **＋** em cada unidade cria uma matéria (título obrigatório; subtítulo,
       corpo rich-text com tabelas, local/data e assinatura opcionais).
   - Partes sem matéria exibem **"SEM ALTERAÇÃO"** automaticamente.
3. A **prévia à direita** reflete o documento final em tempo real; tudo é salvo
   automaticamente.
4. **⬇ Baixar BGBM (PDF)** — abre o diálogo de impressão. Escolha
   **"Salvar como PDF"**. O cabeçalho institucional se repete em cada página e a
   numeração incrementa a partir da página inicial (321 → 322 → 323…).

> Dica de impressão: no diálogo do navegador, mantenha **"Gráficos de plano de
> fundo / Background graphics"** ativado para preservar as cores das faixas.

---

## Estrutura de arquivos

```
bgbm/
├── backend/
│   ├── main.py         # API FastAPI + serve o front
│   ├── db.py           # SQLite: schema e CRUD
│   ├── constants.py    # partes e ordem institucional das unidades
│   ├── assets/         # brasão, visto e assinaturas (Chefe EM / Ajudante-Geral)
│   └── bgbm.db         # criado em runtime
├── frontend/
│   ├── index.html      # UI + CSS (tela e impressão)
│   └── app.js          # lógica: CRUD, árvore de edição, editor, render, PDF
└── README.md
```

---

## API (referência rápida)

| Método | Rota                     | Descrição                              |
|--------|--------------------------|----------------------------------------|
| GET    | `/api/meta`              | Partes, ordem de unidades, assets (base64) |
| GET    | `/api/bgbm`              | Lista todos os BGBM                    |
| POST   | `/api/bgbm`              | Cria um BGBM                           |
| GET    | `/api/bgbm/{id}`         | Obtém um BGBM completo                 |
| PUT    | `/api/bgbm/{id}`         | Atualiza (cabeçalho e/ou conteúdo)     |
| DELETE | `/api/bgbm/{id}`         | Exclui                                 |
| POST   | `/api/unidades/ordenar`  | Ordena nomes de unidade pela ordem oficial |

Documentação interativa automática em **`/docs`** (Swagger).

---

## Notas sobre as assinaturas institucionais

As imagens de assinatura (Chefe do Estado-Maior e Ajudante-Geral), o brasão e o
"visto" foram extraídos do material fornecido e ficam em `backend/assets/`.
Para trocar quando houver mudança de autoridade, basta substituir os arquivos
PNG correspondentes — nenhuma alteração de código é necessária.

## Próximos passos sugeridos

- Editor visual de células de tabela (mesclagem, alinhamento por célula).
- Substituição de assinaturas pela própria interface (upload).
- Módulos BEBM / BGBMR / Diário Oficial reaproveitando o mesmo motor de render.
- Geração de PDF no servidor (WeasyPrint/Playwright) para não depender do
  diálogo do navegador, caso queira um botão de download direto.
