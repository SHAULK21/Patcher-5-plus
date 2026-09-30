import sys
import unittest
from pathlib import Path
from types import ModuleType
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class StreamlitStartupTests(unittest.TestCase):
    def test_main_ignores_cached_module_without_render_app(self):
        stale = ModuleType("streamlit_app")
        with patch.dict(sys.modules, {"streamlit_app": stale}):
            app = AppTest.from_file(str(ROOT / "main.py")).run(timeout=20)
            self.assertEqual(len(app.exception), 0)
            self.assertEqual(len(app.title), 1)
            app.run(timeout=20)
            self.assertEqual(len(app.exception), 0)
            self.assertEqual(len(app.title), 1)

    def test_both_entrypoints_render_after_rerun_and_in_new_sessions(self):
        for filename in ("main.py", "streamlit_app.py"):
            for session in range(2):
                with self.subTest(filename=filename, session=session):
                    app = AppTest.from_file(str(ROOT / filename)).run(timeout=20)
                    self.assertEqual(len(app.exception), 0)
                    self.assertEqual(len(app.title), 1)
                    self.assertEqual(app.number_input[0].value, 35)
                    app.number_input[0].set_value(30).run(timeout=20)
                    self.assertEqual(len(app.exception), 0)
                    self.assertEqual(len(app.title), 1)
                    self.assertEqual(app.number_input[0].value, 30)
                    app.run(timeout=20)
                    self.assertEqual(len(app.title), 1)
                    self.assertEqual(len(app.exception), 0)


if __name__ == "__main__":
    unittest.main()
