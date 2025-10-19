import json, os
from typing import Dict, Any, Optional
_ERAS = None

def _load():
    global _ERAS
    if _ERAS is None:
        p = os.path.join(os.path.dirname(__file__), "..", "sample_data", "eras.json")
        with open(p, "r") as f:
            _ERAS = json.load(f)
    return _ERAS

def era_for_year(year: int) -> Optional[Dict[str, Any]]:
    for era in _load():
        if era["start"] <= year <= era["end"]:
            return era
    return None
