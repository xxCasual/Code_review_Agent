from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    deepseek_api_key: str | None = Field(default=None, alias="DEEPSEEK_API_KEY")
    deepseek_base_url: str = Field(default="https://api.deepseek.com", alias="DEEPSEEK_BASE_URL")
    deepseek_model: str = Field(default="deepseek-v4-pro", alias="DEEPSEEK_MODEL")
    github_token: str | None = Field(default=None, alias="GITHUB_TOKEN")
    review_store_path: str = Field(default="reviews.sqlite3", alias="REVIEW_STORE_PATH")
    repo_cache_dir: str = Field(default=".cache/repos", alias="REPO_CACHE_DIR")
    review_agent_demo_fixture: str | None = Field(default=None, alias="REVIEW_AGENT_DEMO_FIXTURE")
    review_agent_llm_timeout_seconds: float = Field(
        default=45.0, alias="REVIEW_AGENT_LLM_TIMEOUT_SECONDS"
    )
    review_agent_llm_max_retries: int = Field(default=1, alias="REVIEW_AGENT_LLM_MAX_RETRIES")
    review_agent_log_level: str = Field(default="INFO", alias="REVIEW_AGENT_LOG_LEVEL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
