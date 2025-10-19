import os
from flask import request, jsonify, redirect
from . import create_app
from .services.entities import get_entity
from .services.trivia import get_trivia_for_entity
from .services.eras import era_for_year

app = create_app()

@app.get("/api/entity/<int:entity_id>")
def api_entity(entity_id):
    e = get_entity(entity_id)
    if not e:
        return jsonify({"error": "not_found"}), 404
    era = era_for_year(e.get("era_hint_year", 0))
    return jsonify({"entity": e, "era": era})

@app.get("/api/trivia/<int:entity_id>")
def api_trivia(entity_id):
    return jsonify({"entityId": entity_id, "questions": get_trivia_for_entity(entity_id)})

@app.get("/api/era/by-year")
def api_era_by_year():
    year = int(request.args.get("year", 0))
    era = era_for_year(year)
    if not era:
        return jsonify({"error": "no_era"}), 404
    return jsonify({"era": era})

@app.get("/qr/<int:entity_id>")
def qr_redirect(entity_id):
    game_url = os.getenv("GAME_URL", "http://localhost:5173/index.html")
    return redirect(f"{game_url}?entity={entity_id}", code=302)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
