# queries app — intentionally empty.
#
# SavedQuery model and endpoints are owned by the `insights` app:
#   - Model:    insights.models.SavedQuery
#   - Endpoint: GET/POST /api/v1/saved-queries/
#   - Views:    insights.views.SavedQueryListView
#
# This app exists in INSTALLED_APPS for historical reasons.
# Its migrations folder contains only __init__.py (no table created here).
