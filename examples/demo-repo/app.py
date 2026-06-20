# Demo: CI fails until `requests` is listed in requirements.txt (PipelineMedic can suggest a PR).
import requests

print("ok", requests.__version__)
