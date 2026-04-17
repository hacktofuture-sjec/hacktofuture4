import asyncio
import json
from playwright.async_api import async_playwright
import urllib.parse

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        # Set a polite user agent
        await page.set_extra_http_headers({"User-Agent": "MyAgencyApp/1.0"})
        query = urllib.parse.quote("restaurants in Austin")
        url = f"https://nominatim.openstreetmap.org/search.php?q={query}&format=jsonv2"
        print(f"Navigating to {url}...")
        await page.goto(url, timeout=15000)
        
        # Parse the JSON string from the page content
        content = await page.locator("body").text_content()
        try:
            data = json.loads(content)
            print(f"Found {len(data)} results")
            for item in data[:5]:
                print("Found:", item.get('display_name').split(',')[0])
                print("Type:", item.get('type'))
        except Exception as e:
            print("Parse Error:", e)
        await browser.close()

asyncio.run(run())
