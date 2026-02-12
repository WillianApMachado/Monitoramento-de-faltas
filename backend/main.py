import json
import os
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# Inicializa o servidor
app = FastAPI(title="Monitoramento de Presenca - API Local")

# Permite que o Frontend acesse este servidor
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Caminho do banco de dados simples
DB_FILE = "database.json"

# Modelos de dados
class Absence(BaseModel):
    id: str
    user_id: str
    subject_id: str
    date: str

class UserProfile(BaseModel):
    user_id: str
    display_name: str
    total_absences: int

# Funcoes de manipulacao do arquivo JSON
def load_db() -> Dict:
    if not os.path.exists(DB_FILE):
        return {"absences": [], "users": {}}
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {"absences": [], "users": {}}

def save_db(data: Dict):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

# Rotas da API
@app.get("/")
def root():
    return {"status": "online", "message": "API de Monitoramento de Presenca"}

@app.get("/absences/{user_id}")
def get_absences(user_id: str):
    db = load_db()
    return [a for a in db["absences"] if a["user_id"] == user_id]

@app.post("/absences/")
def save_absence(absence: Absence):
    db = load_db()
    if any(a["id"] == absence.id for a in db["absences"]):
        return {"status": "exists"}
    db["absences"].append(absence.model_dump())
    save_db(db)
    return {"status": "saved"}

@app.delete("/absences/{absence_id}")
def delete_absence(absence_id: str):
    db = load_db()
    db["absences"] = [a for a in db["absences"] if a["id"] != absence_id]
    save_db(db)
    return {"status": "deleted"}

@app.get("/ranking/")
def get_ranking():
    db = load_db()
    users_list = list(db["users"].values())
    # Ordena por MENOS faltas (quem falta menos fica em primeiro)
    return sorted(users_list, key=lambda x: x.get("total_absences", 0))

@app.post("/profile/")
def update_profile(profile: UserProfile):
    db = load_db()
    db["users"][profile.user_id] = profile.model_dump()
    save_db(db)
    return {"status": "updated"}

@app.get("/user/{username}")
def get_user(username: str):
    db = load_db()
    if username in db["users"]:
        return {"exists": True, "user": db["users"][username]}
    return {"exists": False}

@app.post("/register/{username}")
def register_user(username: str):
    db = load_db()
    if username in db["users"]:
        return {"status": "exists", "message": "Username ja existe"}
    db["users"][username] = {
        "user_id": username,
        "display_name": username,
        "total_absences": 0
    }
    save_db(db)
    return {"status": "created"}

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("  SERVIDOR INICIADO!")
    print("  Acesse: http://localhost:8000")
    print("  Docs:   http://localhost:8000/docs")
    print("="*50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
