import json, os
_DATA = None

def _load():
    global _DATA
    if _DATA is None:
        p = os.path.join(os.path.dirname(__file__), "..", "sample_data", "trivia.json")
        with open(p, "r") as f:
            _DATA = json.load(f)
    return _DATA

def get_trivia_for_entity(entity_id: int):
    data = _load()
    return data.get(str(entity_id), [])
