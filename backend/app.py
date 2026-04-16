from flask import Flask
from flask_cors import CORS
from routes.session_routes import session_bp

app = Flask(__name__)
CORS(app)

# Register routes
app.register_blueprint(session_bp)

@app.route("/")
def home():
    return "Backend is running 🚀"

if __name__ == "__main__":
    app.run(debug=True)