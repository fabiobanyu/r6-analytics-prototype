"""Compatibility launcher for the local HTML prototype; no Flask server or database."""
from pathlib import Path
import webbrowser
webbrowser.open((Path(__file__).resolve().parent/'index.html').as_uri())
