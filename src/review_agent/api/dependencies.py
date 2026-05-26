from functools import lru_cache

from review_agent.config import get_settings
from review_agent.services.review_store import ReviewStore


@lru_cache(maxsize=1)
def get_review_store() -> ReviewStore:
    return ReviewStore(get_settings().review_store_path)
