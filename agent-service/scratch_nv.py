import asyncio
import logging
from pprint import pprint

from dotenv import load_dotenv

load_dotenv()

# We set logging to DEBUG to see the HTTP requests
logging.basicConfig(level=logging.DEBUG)


async def test_nvidia():
    from src.config import settings

    print(f"Key: {settings.openai_api_key[:5]}...")
    print(f"Base URL: {settings.openai_api_base_url}")
    print(f"Model: {settings.llm_model}")

    from src.agents.action_orchestrator import run_action_orchestrator

    try:
        res = await run_action_orchestrator(
            "Report a bug in Jira and message the dev team in Slack"
        )
        pprint(res.model_dump())
    except Exception as e:
        print(f"Exception: {e}")


if __name__ == "__main__":
    asyncio.run(test_nvidia())
