"""FastAPI host: serve /auth/invite-required and a stub POST /api/v1/invites/redeem.

uvicorn embed:app --port 8000 → http://localhost:8000/auth/invite-required
"""
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel

app = FastAPI()

PAGE = """<!doctype html>
<html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>invite required</title>
<script type="module" src="https://cdn.derobot.is/tobor-kit/latest/components/invite-gate/noizu-invite-gate.js"></script>
</head><body><noizu-invite-gate brand="therobotplans" sign-out-url="/logout"></noizu-invite-gate></body></html>"""


class Redeem(BaseModel):
    token: str


@app.get("/auth/invite-required", response_class=HTMLResponse)
def invite_required() -> str:
    return PAGE


# Stub. The real route authenticates the session, is exempt from the invite gate,
# is rate-limited, and redeems in one transaction.
@app.post("/api/v1/invites/redeem")
def redeem(body: Redeem) -> JSONResponse:
    if body.token == "GOOD-INVITE":
        return JSONResponse({"organization_id": "org-1", "role": "member", "invite_required": False})
    if body.token == "USED-INVITE":
        return JSONResponse({"error": "This invite has already been used"}, status_code=409)
    return JSONResponse({"error": "Invalid or expired invite token"}, status_code=404)
