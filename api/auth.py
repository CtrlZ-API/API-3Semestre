"""
auth.py — Autenticação completa (Tarefas 8.1 e 8.2)

Responsabilidades deste arquivo:
  - Migração: cria/verifica a tabela 'usuarios' no banco SQLite
  - Seed:     insere o usuário administrador inicial (idempotente)
  - Router:   POST /api/auth/registrar  — cria nova conta
              POST /api/auth/login      — autentica e retorna JWT
"""

import os
import sqlite3
import bcrypt
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, status
from jose import jwt
from pydantic import BaseModel, EmailStr, field_validator


SECRET_KEY = os.getenv("JWT_SECRET_KEY", "teste-de-chave")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _get_db_path() -> str:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return os.path.join(BASE_DIR, "data", "dados_credito.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(_get_db_path())
    conn.row_factory = sqlite3.Row
    return conn



def _hash_senha(senha: str) -> str:
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verificar_senha(senha_plain: str, senha_hash: str) -> bool:
    return bcrypt.checkpw(senha_plain.encode("utf-8"), senha_hash.encode("utf-8"))


def run_migrations():
    """Cria a tabela 'usuarios' e o índice de email se não existirem."""
    conn = sqlite3.connect(_get_db_path())
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id           INTEGER  PRIMARY KEY AUTOINCREMENT,
            nome         TEXT     NOT NULL,
            email        TEXT     NOT NULL UNIQUE,
            senha_hash   TEXT     NOT NULL,
            perfil       TEXT     NOT NULL CHECK(perfil IN ('analista', 'gestor', 'admin')),
            data_criacao DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
    """)
    conn.commit()
    conn.close()
    print("✅ Migração executada: tabela 'usuarios' criada/verificada.")


def run_seed():
    """Insere o usuário administrador inicial. Não duplica se já existir."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM usuarios WHERE email = ?", ("admin@ctrlz.com",))
    if cursor.fetchone():
        conn.close()
        return

    cursor.execute(
        "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)",
        ("Administrador", "admin@ctrlz.com", _hash_senha("CtrlZ@2025"), "admin"),
    )
    conn.commit()
    conn.close()
    print("✅ Usuário admin criado automaticamente.")
    print("   Email : admin@ctrlz.com")
    print("   Senha : CtrlZ@2025")
    print("   Perfil: admin")


class RegistroRequest(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    perfil: str  # "analista" | "gestor"

    @field_validator("senha")
    @classmethod
    def senha_minimo_6(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("A senha deve ter no mínimo 6 caracteres.")
        return v

    @field_validator("perfil")
    @classmethod
    def perfil_valido(cls, v: str) -> str:
        permitidos = {"analista", "gestor"}
        if v not in permitidos:
            raise ValueError(f"Perfil inválido. Use: {permitidos}")
        return v


class UsuarioResponse(BaseModel):
    id: int
    nome: str
    email: str
    perfil: str
    data_criacao: str


class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioResponse


def _criar_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _row_to_usuario(row: sqlite3.Row) -> UsuarioResponse:
    return UsuarioResponse(
        id=row["id"],
        nome=row["nome"],
        email=row["email"],
        perfil=row["perfil"],
        data_criacao=row["data_criacao"],
    )


@router.post(
    "/registrar",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar novo usuário",
)
def registrar(body: RegistroRequest):
    """
    Cria uma nova conta no sistema.

    - **nome**: Nome completo
    - **email**: E-mail válido (único no sistema)
    - **senha**: Mínimo 6 caracteres — armazenada como hash bcrypt
    - **perfil**: `analista` ou `gestor`
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM usuarios WHERE email = ?", (body.email,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="E-mail já cadastrado.",
            )

        cursor.execute(
            "INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES (?, ?, ?, ?)",
            (body.nome, body.email, _hash_senha(body.senha), body.perfil),
        )
        conn.commit()

        cursor.execute("SELECT * FROM usuarios WHERE id = ?", (cursor.lastrowid,))
        usuario = cursor.fetchone()

    except HTTPException:
        raise
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Erro no banco: {exc}") from exc
    finally:
        conn.close()

    return _row_to_usuario(usuario)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Autenticar usuário e obter JWT",
)
def login(body: LoginRequest):
    """
    Autentica com e-mail e senha.
    Retorna um **JWT Bearer token** válido por 8 horas e os dados do usuário (sem senha).
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM usuarios WHERE email = ?", (body.email,))
        usuario = cursor.fetchone()
    except sqlite3.Error as exc:
        raise HTTPException(status_code=500, detail=f"Erro no banco: {exc}") from exc
    finally:
        conn.close()

    if not usuario or not _verificar_senha(body.senha, usuario["senha_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha inválidos.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = _criar_token({"sub": str(usuario["id"]), "perfil": usuario["perfil"]})
    return TokenResponse(access_token=token, usuario=_row_to_usuario(usuario))