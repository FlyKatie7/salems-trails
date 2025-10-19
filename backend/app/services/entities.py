import json, os
_DATA = None

def _load():
    global _DATA
    if _DATA is None:
        p = os.path.join(os.path.dirname(__file__), "..", "sample_data", "entities.json")
        with open(p, "r") as f:
            _DATA = json.load(f)
    return _DATA

def get_entity(entity_id: int):
    for e in _load():
        if e["id"] == entity_id:
            return e
    return None
