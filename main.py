"""Execute the Streamlit UI from source on every rerun.

Streamlit Cloud may retain an older imported module during a live update.
Running the file avoids relying on a cached render_app export.
"""
from pathlib import Path
import runpy

if __name__ == "__main__":
    runpy.run_path(str(Path(__file__).resolve().with_name("streamlit_app.py")), run_name="__main__")
