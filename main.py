"""Streamlit entrypoint. Render on every script rerun, even when imports are cached."""
from streamlit_app import render_app

if __name__ == "__main__":
    render_app()
