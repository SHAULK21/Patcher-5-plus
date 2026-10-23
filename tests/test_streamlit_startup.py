import sys
import hashlib
import os
import unittest
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import patch

from streamlit.testing.v1 import AppTest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class StreamlitStartupTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("REFERENCE_FW"), "Set REFERENCE_FW for UI integration test")
    def test_live_update_discards_legacy_artifact_and_repairs_all_crcs(self):
        raw = Path(os.environ["REFERENCE_FW"]).read_bytes()
        uploaded = SimpleNamespace(getvalue=lambda: raw)
        with patch("streamlit.file_uploader", return_value=uploaded):
            app = AppTest.from_file(str(ROOT / "streamlit_app.py"))
            app.session_state["patch_artifact"] = {
                "identity": (hashlib.sha256(raw).hexdigest(), 35),
                "output": b"legacy output with stale CRC", "report": {"crc_valid": True},
            }
            app.run(timeout=20)
            self.assertEqual(len(app.exception), 0)
            self.assertNotIn("patch_artifact", app.session_state)
            app.button[0].click().run(timeout=20)
            self.assertEqual(len(app.exception), 0)
            artifact = app.session_state["patch_artifact"]
            self.assertEqual(artifact["report"]["schema_version"], 2)
            self.assertTrue(artifact["report"]["crc_valid"])
            self.assertEqual(artifact["output"][0x11:0x13], bytes.fromhex("C4 8A"))
            self.assertEqual(artifact["output"][0x8D00:], raw[0x8D00:])

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
