from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Ollama
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3:8b"
    OLLAMA_TIMEOUT: int = 180

    # News RSS Feeds — free, no API key required
    RSS_FEEDS: List[str] = [
        "https://feeds.bbci.co.uk/news/business/rss.xml",
        "https://techcrunch.com/feed/",
        "https://hnrss.org/frontpage",
        "https://www.theverge.com/rss/index.xml",
        "https://feeds.arstechnica.com/arstechnica/index",
    ]

    RSS_FEED_NAMES: List[str] = [
        "BBC Business",
        "TechCrunch",
        "Hacker News",
        "The Verge",
        "Ars Technica",
    ]

    # Processing constraints
    MAX_ARTICLES_PER_FETCH: int = 25
    MAX_PROBLEMS_TO_GENERATE: int = 5

    # Database
    DATABASE_URL: str = "sqlite:///./problems.db"

    class Config:
        env_file = ".env"


settings = Settings()
