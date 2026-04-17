from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional
import uuid

from agency.scraper.maps_scraper import scrape_businesses, detect_opportunity
from agency.generator.content_engine import generate_website_content
from agency.generator.builder import build_site
# If Supabase was fully connected for DDL we'd use it here. 
# For MVP, we will use an in-memory store if DB fails, or try DB.
from database.db import get_supabase

router = APIRouter(prefix="/api/agency", tags=["Agency"])

# In-memory fallback if DB isn't initialized yet by user
_mock_db = []

class ScrapeRequest(BaseModel):
    city: str
    category: str = "restaurants"

class GenerateRequest(BaseModel):
    business_id: str

@router.post("/scrape")
async def trigger_scrape(req: ScrapeRequest):
    """
    Trigger Playwright scraper to find prospect businesses in a city.
    Scores them and saves to DB.
    """
    raw_businesses = await scrape_businesses(req.city, req.category)
    
    scored_businesses = []
    for b in raw_businesses:
        scored = detect_opportunity(b)
        # Give mock UUID for memory
        scored["id"] = str(uuid.uuid4())
        scored_businesses.append(scored)
        
    global _mock_db
    _mock_db.extend(scored_businesses)
    
    # Try inserting to Supabase if table exists
    try:
        sb = get_supabase()
        for sb_b in scored_businesses:
            # We skip inserting into DB if it fails to keep the MVP working in-memory
            sb_data = {
                "id": sb_b["id"],
                "name": sb_b["name"],
                "category": sb_b["category"],
                "google_rating": sb_b.get("rating"),
                "review_count": sb_b.get("reviews"),
                "website_url": sb_b.get("url"),
                "has_poor_presence": sb_b.get("has_poor_presence", False)
            }
            sb.table("businesses").insert(sb_data).execute()
    except Exception as e:
        print(f"DB insert skipped: {e}")

    return {"status": "success", "found": len(scored_businesses)}

@router.get("/leads")
async def get_leads():
    """
    Fetch all leads.
    """
    try:
        sb = get_supabase()
        res = sb.table("businesses").select("*").execute()
        if res.data:
            # We need to compute reasons if they aren't stored, and join contact_status
            from agency.scraper.maps_scraper import detect_opportunity
            for lead in res.data:
                # Provide a more detailed and dynamic reason based on the rating and reviews, rather than a generic string
                rev = lead.get("review_count") or lead.get("reviews") or 0
                rat = lead.get("google_rating") or lead.get("rating") or 0
                
                if lead.get("has_poor_presence"):
                    lead["reasons"] = f"Urgent Opportunity: Has {rev} reviews and {rat} stars, but lacks a premium digital presence. Needs a modern website to convert traffic."
                else:
                    lead["reasons"] = f"Healthy presence with {rat} stars. Could still benefit from our advanced CRM loop."
                
                # Fetch preview URL if it was generated
                c_res = sb.table("contact_status").select("*").eq("business_id", lead["id"]).execute()
                if c_res.data and c_res.data[0].get("preview_site_url"):
                    lead["preview_url"] = c_res.data[0]["preview_site_url"]
                    
            return res.data
    except Exception as e:
        print(f"Error fetching from supabase: {e}")
        pass
        
    return _mock_db

@router.post("/generate-site/{business_id}")
async def generate_preview_site(business_id: str):
    """
    Generates a website for the prospect using LLM and templating.
    """
    # Find business
    business = None
    try:
        sb = get_supabase()
        res = sb.table("businesses").select("*").eq("id", business_id).execute()
        if res.data:
            business = res.data[0]
    except Exception:
        pass
        
    if not business:
        for b in _mock_db:
            if b["id"] == business_id:
                business = b
                break
                
    if not business:
        raise HTTPException(status_code=404, detail="Business not found")
        
    # Generate content
    content = generate_website_content(
        business_name=business.get("name", "Local Business"),
        category=business.get("category", "Restaurant"),
        rating=business.get("google_rating", business.get("rating", 4.0)),
        reviews=business.get("review_count", business.get("reviews", 10))
    )
    content["business_name"] = business.get("name", "Local Business")
    content["rating"] = business.get("google_rating", business.get("rating", 4.0))
    content["reviews"] = business.get("review_count", business.get("reviews", 10))
    
    # Build HTML
    preview_url = build_site("restaurant.html", content, business_id)
    
    # Try to save the generated site link into Supabase's contact_status table
    try:
        sb = get_supabase()
        c_res = sb.table("contact_status").select("*").eq("business_id", business_id).execute()
        if c_res.data:
            sb.table("contact_status").update({"preview_site_url": preview_url}).eq("business_id", business_id).execute()
        else:
            sb.table("contact_status").insert({"business_id": business_id, "preview_site_url": preview_url}).execute()
    except Exception as e:
        print(f"DB update skipped: {e}")

    # Update in-memory fallback
    for b in _mock_db:
        if b["id"] == business_id:
            b["preview_url"] = preview_url
    
    return {"status": "success", "preview_url": preview_url}

@router.delete("/leads")
async def clear_leads():
    """
    Clear all scraped leads from Supabase and in-memory fallback.
    """
    global _mock_db
    _mock_db.clear()
    
    try:
        sb = get_supabase()
        # Since business_id cascades, deleting businesses clears everything.
        # We delete anything where id is not null (everything)
        sb.table("businesses").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()
    except Exception as e:
        print(f"Clear leads error: {e}")
        pass
        
    return {"status": "cleared"}
