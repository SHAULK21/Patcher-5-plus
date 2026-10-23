import hashlib
import binascii
import os
import unittest
from pathlib import Path
from unittest.mock import patch

import verified_patcher as core

def synthetic_fixture():
    # Not a scooter firmware. Test-only identity used to exercise positive paths.
    data = bytearray(core.REFERENCE_SIZE)
    data[0x90:0x90+len(core.MARKER)] = core.MARKER
    data[0x86:0x88] = bytes.fromhex("8C 00")
    data[0x5C74:0x5C7A] = core.SPEED_SIG
    data[0x5C7A:0x5C82] = bytes.fromhex("AB 48 40 7A 06 28 02 D9")
    data[0x5F24:0x5F28] = bytes.fromhex("34 02 00 20")
    data[0x5C9E:0x5CA0] = bytes.fromhex("42 54")
    data[0x1E484:0x1E48C] = core.OTA_MAGIC
    model_off = 0x1E4A0
    data[model_off:model_off+len(core.MODEL_MARKER)] = core.MODEL_MARKER
    cert_off = 0x1E500
    data[cert_off:cert_off+len(core.CERT_MAGIC)] = core.CERT_MAGIC
    data[0xB0:0xB2] = core.crc16_ccitt(data[0x100:0x8D00]).to_bytes(2, "big")
    data[0x11:0x13] = binascii.crc_hqx(data[0x80:0x8D00], 0).to_bytes(2, "little")
    data[0x1F:0x21] = binascii.crc_hqx(data[0x8D00:0x1E480], 0).to_bytes(2, "little")
    return bytes(data)

class StrictPatcherTests(unittest.TestCase):
    def test_crc_standard_vector(self):
        self.assertEqual(core.crc16_ccitt(b"123456789"), 0x31C3)

    def test_production_identity_rejects_synthetic(self):
        with self.assertRaises(ValueError):
            core.Mi5PlusPatcher.patch_speed(synthetic_fixture(), 35)

    def test_small_ambiguous_and_missing(self):
        for data in (b"", b"junk" + core.SPEED_SIG, core.SPEED_SIG * 2):
            with self.assertRaises(ValueError):
                core.Mi5PlusPatcher.patch_speed(data, 35)
        self.assertIsNone(core.Mi5PlusPatcher.analyze(b"junk")["ota_trailer"])

    def test_input_types_and_bounds(self):
        for v in (True, 0, 61, 255, 35.9, "35", None):
            with self.assertRaises(ValueError):
                core.Mi5PlusPatcher.patch_speed(b"", v)

    def test_positive_paths_with_test_only_identity(self):
        raw = synthetic_fixture()
        digest = hashlib.sha256(raw).hexdigest()
        with patch.object(core, "REFERENCE_SHA256", digest):
            for value in (1, 25, 35, 60):
                output = core.Mi5PlusPatcher.patch_speed(raw, value)
                report = core.Mi5PlusPatcher.verify_output(raw, output, value)
                self.assertTrue(report["crc_valid"])
                self.assertTrue(report["inner_component_crc_valid"])
                self.assertTrue(report["outer_component_crc_valid"])
                self.assertTrue(report["second_component_crc_valid"])
                self.assertEqual(int.from_bytes(output[0x11:0x13], "little"),
                                 binascii.crc_hqx(output[0x80:0x8D00], 0))
                self.assertFalse(report["hardware_flash_verified"])
                self.assertFalse(report["kers_modified"])
                self.assertEqual(output[0x5C9E:0x5CA0], raw[0x5C9E:0x5CA0])
                self.assertEqual(output[0x1E484:], raw[0x1E484:])
                self.assertEqual(output[0x8D00:], raw[0x8D00:])
                self.assertEqual(len(output), len(raw))
                self.assertEqual(output[0x5C76:0x5C78], bytes((value, 0x20)))
                self.assertLessEqual(set(report["changed_offsets"]), {0x11, 0x12, 0xB0, 0xB1, 0x5C76, 0x5C77})
                with self.assertRaises(ValueError):
                    core.Mi5PlusPatcher.patch_speed(output, 35)

    def test_corruption_rejected_even_with_valid_crc(self):
        raw = synthetic_fixture()
        with patch.object(core, "REFERENCE_SHA256", hashlib.sha256(raw).hexdigest()):
            for off in (0, 0x86, 0x200, 0x5C74, 0x5C78, 0x5F24, 0x5C9E, 0x8D00, 0x1E484):
                corrupt = bytearray(raw)
                corrupt[off] ^= 1
                corrupt[0xB0:0xB2] = core.crc16_ccitt(corrupt[0x100:0x8D00]).to_bytes(2, "big")
                with self.assertRaises(ValueError):
                    core.Mi5PlusPatcher.patch_speed(bytes(corrupt), 35)

    def test_output_extra_changes_and_stale_crc_rejected(self):
        raw = synthetic_fixture()
        with patch.object(core, "REFERENCE_SHA256", hashlib.sha256(raw).hexdigest()):
            output = bytearray(core.Mi5PlusPatcher.patch_speed(raw, 35))
            output[0x5C9E] ^= 1
            with self.assertRaises(ValueError):
                core.Mi5PlusPatcher.verify_output(raw, bytes(output), 35)
            output = bytearray(raw)
            output[0x5C76:0x5C78] = b"\x23\x20"
            with self.assertRaises(ValueError):
                core.Mi5PlusPatcher.verify_output(raw, bytes(output), 35)

    def test_independent_thumb_decode(self):
        from capstone import Cs, CS_ARCH_ARM, CS_MODE_THUMB
        md = Cs(CS_ARCH_ARM, CS_MODE_THUMB)
        hook = list(md.disasm(core.SPEED_SIG, 0x5C74))
        self.assertEqual([i.mnemonic for i in hook], ["ldr", "ldrb", "strh"])
        rejected = list(md.disasm(bytes.fromhex("42 54"), 0x5C9E))
        self.assertEqual(rejected[0].mnemonic, "strb")
        self.assertEqual(rejected[0].op_str, "r2, [r0, r1]")

    def test_stale_input_crc_rejected(self):
        raw = synthetic_fixture()
        with patch.object(core, "REFERENCE_SHA256", hashlib.sha256(raw).hexdigest()):
            corrupt = bytearray(raw)
            corrupt[0xB0] ^= 1
            with self.assertRaises(ValueError):
                core.Mi5PlusPatcher.patch_speed(bytes(corrupt), 35)

    def test_stale_outer_output_crc_rejected(self):
        raw = synthetic_fixture()
        with patch.object(core, "REFERENCE_SHA256", hashlib.sha256(raw).hexdigest()):
            legacy = bytearray(raw)
            legacy[0x5C76:0x5C78] = b"\x23\x20"
            legacy[0xB0:0xB2] = binascii.crc_hqx(legacy[0x100:0x8D00], 0).to_bytes(2, "big")
            # Reproduces the old writer: valid inner CRC, stale outer CRC.
            self.assertTrue(core.check_component_crcs(legacy)["inner_component"]["valid"])
            self.assertFalse(core.check_component_crcs(legacy)["outer_component"]["valid"])
            with self.assertRaisesRegex(ValueError, "outer_component CRC"):
                core.Mi5PlusPatcher.verify_output(raw, bytes(legacy), 35)

    def test_component_crc_corruption_and_truncation(self):
        raw = synthetic_fixture()
        for field in (0x11, 0xB0, 0x1F):
            corrupt = bytearray(raw)
            corrupt[field] ^= 1
            corrupt = bytes(corrupt)
            # Bypass only the fixture identity so input CRC guards are exercised.
            with patch.object(core, "REFERENCE_SHA256", hashlib.sha256(corrupt).hexdigest()):
                with self.assertRaisesRegex(ValueError, "CRC is invalid"):
                    core.Mi5PlusPatcher.validate_reference(corrupt)
        for data in (b"", raw[:0x8D00], raw[:0x1E47F]):
            self.assertFalse(core.crc_status(core.check_component_crcs(data))["crc_valid"])

    def test_output_rejects_corrupted_or_rechecksummed_second_component(self):
        raw = synthetic_fixture()
        with patch.object(core, "REFERENCE_SHA256", hashlib.sha256(raw).hexdigest()):
            output = bytearray(core.Mi5PlusPatcher.patch_speed(raw, 35))
            output[0x8D20] ^= 1
            output[0x1F:0x21] = binascii.crc_hqx(output[0x8D00:0x1E480], 0).to_bytes(2, "little")
            with self.assertRaisesRegex(ValueError, "Unexpected bytes"):
                core.Mi5PlusPatcher.verify_output(raw, bytes(output), 35)

    def test_unverified_extraction_always_refused(self):
        for data in (b"", synthetic_fixture()):
            with self.assertRaises(ValueError):
                core.Mi5PlusPatcher.extract_ota_image(data)
            with self.assertRaises(ValueError):
                core.Mi5PlusPatcher.patch_and_extract(data, 35)

    @unittest.skipUnless(os.environ.get("REFERENCE_FW"), "Original OTA not bundled; set REFERENCE_FW")
    def test_real_reference_and_known_crc(self):
        raw = Path(os.environ["REFERENCE_FW"]).read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), core.REFERENCE_SHA256)
        output = core.Mi5PlusPatcher.patch_speed(raw, 35)
        self.assertEqual(output[0xB0:0xB2], bytes.fromhex("9D B1"))
        self.assertEqual(output[0x11:0x13], bytes.fromhex("C4 8A"))
        result = core.Mi5PlusPatcher.verify_output(raw, output, 35)
        self.assertEqual(result["changed_offsets"], [0x11, 0x12, 0xB0, 0xB1, 0x5C76, 0x5C77])
        self.assertEqual(result["ota_signature_verification"], "not_performed")
        self.assertIn("invalidated_by_patch", result["ota_signature_status"])
        self.assertEqual(result["ota_signed_range"], [0, 0x1E4C6])
        self.assertFalse(result["root_trust_verified"])
        from tools.reverse_report import report
        self.assertEqual(report(raw)["hook_ram_destination"], 0x20000234)

if __name__ == "__main__":
    unittest.main()
