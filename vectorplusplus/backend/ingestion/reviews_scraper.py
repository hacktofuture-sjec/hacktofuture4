import uuid
from typing import List, Dict

def generate_simulated_reviews(client_name: str) -> List[Dict]:
    """
    Generate authentic-sounding complaints about the client's business to simulate a review scrape.
    """
    return [
        {
            "id": str(uuid.uuid4()),
            "source": "google_reviews",
            "url": f"https://google.com/maps?q={client_name}#{uuid.uuid4()}",
            "author": "LocalFoodie99",
            "title": "Menu missing prices!",
            "text": f"I visited {client_name} yesterday. The aesthetic is nice but why are the prices not listed on their website menu? Super frustrating.",
            "metrics": {"upvotes": 12, "comments": 2}
        },
        {
            "id": str(uuid.uuid4()),
            "source": "yelp",
            "url": f"https://yelp.com/biz/{client_name}#{uuid.uuid4()}",
            "author": "AustinCritic",
            "title": "Location hard to find",
            "text": "They really need to put a clear Google Maps embed or address in the footer. Drove past it twice.",
            "metrics": {"upvotes": 4, "comments": 0}
        },
        {
            "id": str(uuid.uuid4()),
            "source": "google_reviews",
            "url": f"https://google.com/maps?q={client_name}#{uuid.uuid4()}",
            "author": "VeganLife",
            "title": "Dietary options?",
            "text": "The website doesn't explicitly state if they have gluten-free or vegan options. Please add a Dietary section!",
            "metrics": {"upvotes": 35, "comments": 1}
        }
    ]

def get_manual_override_review(client_name: str, query: str) -> List[Dict]:
    return [{
            "id": str(uuid.uuid4()),
            "source": "manual",
            "url": f"https://client-portal.com",
            "author": "AgencyManager",
            "title": "Client requested change",
            "text": f"Client ({client_name}) explicitly requested: {query}",
            "metrics": {"upvotes": 0, "comments": 0}
    }]
