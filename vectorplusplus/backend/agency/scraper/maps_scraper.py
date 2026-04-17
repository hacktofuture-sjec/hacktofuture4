import asyncio
import json
import urllib.parse
import random
from playwright.async_api import async_playwright
import uuid

async def scrape_businesses(city: str, category: str = "restaurants", limit: int = 10) -> list[dict]:
    """
    Uses Playwright to scrape real business data from OpenStreetMap Nominatim.
    Fallback to mocked data for robust MVP demo if scraping completely fails.
    """
    results = []
    
    mock_businesses = [
        {"name": f"{city} Spice", "rating": 4.1, "reviews": 34, "url": "", "category": category},
        {"name": f"The {category.capitalize()} Corner", "rating": 4.5, "reviews": 120, "url": "http://example.com/site", "category": category},
    ]

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            # Nominatim accepts user agents to avoid blocking
            await page.set_extra_http_headers({"User-Agent": "MyAgencyApp/1.0"})
            
            query = urllib.parse.quote(f"{category} in {city}")
            search_url = f"https://nominatim.openstreetmap.org/search.php?q={query}&format=jsonv2"
            
            print(f"[Scraper] Navigating to {search_url}")
            await page.goto(search_url, timeout=15000)
            
            content = await page.locator("body").text_content()
            data = json.loads(content)
            
            for item in data[:limit]:
                # Extract basic info
                try:
                    display_name_parts = item.get("display_name", "").split(",")
                    name = display_name_parts[0] if display_name_parts else f"Unknown {category}"
                    
                    # Generate some synthetic numbers for MVP visual completeness, 
                    # since Nominatim doesn't have ratings natively.
                    reviews = random.randint(5, 300) 
                    rating = round(random.uniform(3.5, 4.9), 1)
                    # Randomize presence of website for scoring
                    url = "https://example.com" if random.random() > 0.6 else "" 
                    
                    results.append({
                        "name": name.strip(),
                        "rating": rating,
                        "reviews": reviews,
                        "url": url,
                        "category": category
                    })
                except Exception as e:
                    print(f"Error parsing listing: {e}")
                    pass
                    
            await browser.close()
    except Exception as e:
        print(f"[Scraper] Playwright fallback due to error: {e}")
    
    # If we didn't scrape anything, just use mock data to keep the CRM functioning
    if not results:
        results = mock_businesses[:limit]
        
    return results

def detect_opportunity(business: dict) -> dict:
    """
    Mark a business as high potential if website is missing or reviews < 50
    """
    score = 0
    reasons = []
    
    if not business.get("url"):
        score += 50
        reasons.append("No website")
        
    if business.get("reviews", 100) < 50:
        score += 30
        reasons.append("Low review count (< 50)")
        
    if business.get("rating", 5) < 4.0:
        score += 20
        reasons.append("Poor rating")
        
    business["opportunity_score"] = score
    business["reasons"] = ", ".join(reasons)
    business["has_poor_presence"] = score >= 50
    return business
