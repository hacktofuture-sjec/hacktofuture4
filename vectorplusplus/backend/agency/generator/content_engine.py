import json
from llm.client import chat_text

def generate_website_content(business_name: str, category: str, rating: float, reviews: int) -> dict:
    """
    Uses the LLM to generate premium quality marketing copy for the website template.
    Returns structured JSON with hero_headline, about_text, and a list of services.
    """
    prompt = f"""
    You are an elite copywriter for an agency. We are building a temporary preview website for a highly rated local business to get them to buy our web services.
    
    Business Name: {business_name}
    Category: {category}
    Rating: {rating} stars ({reviews} reviews)
    
    Provide a JSON object EXACTLY in this format with no markdown formatting or backticks around it:
    {{
        "hero_headline": "A short, catchy, modern hero headline designed to WOW.",
        "hero_subheadline": "A highly detailed, compelling supporting sentence that draws the customer in.",
        "about_text": "A rich, detailed 3-4 sentence paragraph praising their great {rating} star rating, diving deeply into what makes them special, describing exactly what atmospheric vibe and feelings a customer would get, and why they are deeply woven into the local fabric.",
        "services": [
            {{"title": "Signature Service 1", "description": "A very detailed, evocative description of what they provide, designed to sell."}},
            {{"title": "Signature Service 2", "description": "A very detailed, evocative description of what they provide, designed to sell."}},
            {{"title": "Exclusive Offering", "description": "A very detailed, evocative description of what they provide, designed to sell."}}
        ]
    }}
    
    ONLY OUTPUT VALID JSON.
    """
    
    response_text = chat_text(prompt=prompt, max_tokens=1500)
    
    # Strip markdown if present
    if response_text.startswith("```json"):
        response_text = response_text[7:]
    if response_text.startswith("```"):
        response_text = response_text[3:]
    if response_text.endswith("```"):
        response_text = response_text[:-3]
        
    try:
        data = json.loads(response_text.strip())
        return data
    except Exception as e:
        print(f"Error parsing LLM JSON: {e} - Raw text: {response_text}")
        return {
            "hero_headline": f"Welcome to {business_name}",
            "hero_subheadline": "The best place in town.",
            "about_text": "We are proud of our excellent service.",
            "services": [{"title": "Main Service", "description": "Inquire for details."}]
        }
