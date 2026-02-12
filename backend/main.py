import os
from typing import List, Dict
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client

# Inicializa o servidor
app = FastAPI(title="Monitoramento de Presenca - API")

# Permite que o Frontend acesse este servidor
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase config
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

def get_supabase() -> Client:
    return create_client(SUPABASE_URL, SUPABASE_KEY)

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

# Rotas da API
@app.get("/")
def root():
    return {"status": "online", "message": "API de Monitoramento de Presenca"}

@app.get("/absences/{user_id}")
def get_absences(user_id: str):
    supabase = get_supabase()
    result = supabase.table("absences").select("*").eq("user_id", user_id).execute()
    return result.data

@app.post("/absences/")
def save_absence(absence: Absence):
    supabase = get_supabase()
    # Check if exists
    existing = supabase.table("absences").select("id").eq("id", absence.id).execute()
    if existing.data:
        return {"status": "exists"}
    # Insert
    supabase.table("absences").insert(absence.model_dump()).execute()
    return {"status": "saved"}

@app.delete("/absences/{absence_id}")
def delete_absence(absence_id: str):
    supabase = get_supabase()
    supabase.table("absences").delete().eq("id", absence_id).execute()
    return {"status": "deleted"}

@app.get("/ranking/")
def get_ranking():
    supabase = get_supabase()
    result = supabase.table("users").select("*").order("total_absences").execute()
    return result.data

@app.post("/profile/")
def update_profile(profile: UserProfile):
    supabase = get_supabase()
    # Upsert (insert or update)
    supabase.table("users").upsert(profile.model_dump()).execute()
    return {"status": "updated"}

@app.get("/user/{username}")
def get_user(username: str):
    supabase = get_supabase()
    result = supabase.table("users").select("*").eq("user_id", username).execute()
    if result.data:
        return {"exists": True, "user": result.data[0]}
    return {"exists": False}

@app.post("/register/{username}")
def register_user(username: str):
    supabase = get_supabase()
    # Check if exists
    existing = supabase.table("users").select("user_id").eq("user_id", username).execute()
    if existing.data:
        return {"status": "exists", "message": "Username ja existe"}
    # Create user
    supabase.table("users").insert({
        "user_id": username,
        "display_name": username,
        "total_absences": 0
    }).execute()
    return {"status": "created"}

if __name__ == "__main__":
    import uvicorn
    print("\n" + "="*50)
    print("  SERVIDOR INICIADO!")
    print("  Acesse: http://localhost:8000")
    print("  Docs:   http://localhost:8000/docs")
    print("="*50 + "\n")
    uvicorn.run(app, host="0.0.0.0", port=8000)
