import os
import unittest
from pathlib import Path


class OtaSignatureTests(unittest.TestCase):
    @unittest.skipUnless(os.environ.get("REFERENCE_FW"), "Set REFERENCE_FW for cryptographic integration test")
    def test_original_valid_and_crc_repaired_patch_invalidates_signature(self):
        from tools.verify_ota import verify_ota_signature
        from verified_patcher import Mi5PlusPatcher
        original = Path(os.environ["REFERENCE_FW"]).read_bytes()
        stock = verify_ota_signature(original)
        self.assertTrue(stock["ota_signature_valid_under_embedded_leaf"])
        self.assertTrue(stock["leaf_certificate_signature_valid_under_embedded_intermediate"])
        self.assertEqual(stock["signed_range"], [0, 0x1E4C6])
        self.assertEqual(stock["signature_length"], 71)
        patched = Mi5PlusPatcher.patch_speed(original, 35)
        manifest = Mi5PlusPatcher.verify_output(original, patched, 35)
        self.assertTrue(manifest["crc_valid"])
        result = verify_ota_signature(patched)
        self.assertFalse(result["ota_signature_valid_under_embedded_leaf"])
        self.assertTrue(result["leaf_certificate_signature_valid_under_embedded_intermediate"])
        self.assertFalse(result["root_trust_verified"])
        with self.assertRaises(ValueError):
            verify_ota_signature(original[:-1])


if __name__ == "__main__":
    unittest.main()
