import os
import io
import uuid
from jinja2 import Environment, FileSystemLoader

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
# Output sites in the frontend public directory so we can host them instantly for the MVP
# Assuming the FastAPI is run from /backend, the path is ../frontend/public/sites
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../frontend/public/sites"))

def build_site(template_name: str, site_data: dict, business_id: str) -> str:
    """
    Takes parsed LLM content and business info, injects into Jinja template,
    and returns the local relative URL to access it in the dashboard.
    """
    env = Environment(loader=FileSystemLoader(TEMPLATE_DIR))
    template = env.get_template(template_name)
    
    html_content = template.render(
        business_name=site_data.get("business_name", "Local Business"),
        hero_headline=site_data.get("hero_headline"),
        hero_subheadline=site_data.get("hero_subheadline"),
        about_text=site_data.get("about_text"),
        services=site_data.get("services", []),
        rating=site_data.get("rating"),
        reviews=site_data.get("reviews")
    )
    
    # Create output directory for the business
    site_slug = f"biz_{str(business_id).replace('-', '')}"
    site_dir = os.path.join(OUTPUT_DIR, site_slug)
    os.makedirs(site_dir, exist_ok=True)
    
    with open(os.path.join(site_dir, "index.html"), "w", encoding="utf-8") as f:
        f.write(html_content)
        
    return f"/sites/{site_slug}/index.html"
