from __future__ import annotations

import logging


def setup_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    # fontTools warns about odd timestamps in many Khmer fonts; not useful
    logging.getLogger("fontTools").setLevel(logging.ERROR)
