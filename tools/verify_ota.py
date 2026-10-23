#!/usr/bin/env python3
"""Read-only verification of the known 5 Plus OTA layout; requires cryptography.

Checks signatures under embedded certificates, without establishing root trust,
bootloader acceptance, or hardware compatibility.
"""
import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verified_patcher import OTA_MAGIC, OTA_SIGNED_END, REFERENCE_SIZE


def verify_ota_signature(raw: bytes) -> dict:
    from cryptography import x509
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import ec, utils

    if len(raw) != REFERENCE_SIZE or raw[0x1E484:0x1E48C] != OTA_MAGIC:
        raise ValueError("Unsupported package layout")
    matches = list(re.finditer(rb"-----BEGIN CERTIFICATE-----.*?-----END CERTIFICATE-----", raw, re.S))
    if len(matches) != 2 or [m.start() for m in matches] != [OTA_SIGNED_END, 0x1E711]:
        raise ValueError("Unexpected certificate layout")
    if matches[0].end() != 0x1E710 or matches[1].end() != 0x1E973:
        raise ValueError("Unexpected certificate boundaries")
    certificates = [x509.load_pem_x509_certificate(m.group()) for m in matches]
    keys = [c.public_key() for c in certificates]
    if any(not isinstance(k, ec.EllipticCurvePublicKey) or not isinstance(k.curve, ec.SECP256R1) for k in keys):
        raise ValueError("Expected P-256 certificate keys")
    if raw[0x1E973:0x1E974] != b"\n":
        raise ValueError("Unexpected signature boundary")
    signature = raw[0x1E974:]
    utils.decode_dss_signature(signature)
    try:
        keys[0].verify(certificates[1].signature, certificates[1].tbs_certificate_bytes,
                       ec.ECDSA(certificates[1].signature_hash_algorithm))
        leaf_valid = True
    except InvalidSignature:
        leaf_valid = False
    try:
        keys[1].verify(signature, raw[:OTA_SIGNED_END], ec.ECDSA(hashes.SHA256()))
        ota_valid = True
    except InvalidSignature:
        ota_valid = False
    return {
        "sha256": hashlib.sha256(raw).hexdigest(),
        "signed_range": [0, OTA_SIGNED_END],
        "signature_offset": 0x1E974, "signature_length": len(signature),
        "algorithm": "ECDSA-SHA256-P256",
        "leaf_certificate_signature_valid_under_embedded_intermediate": leaf_valid,
        "ota_signature_valid_under_embedded_leaf": ota_valid,
        "signature_verification": "performed",
        "root_trust_verified": False, "hardware_flash_verified": False,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    args = parser.parse_args()
    try:
        result = verify_ota_signature(args.input.read_bytes())
        print(json.dumps(result, indent=2))
        raise SystemExit(0 if result["ota_signature_valid_under_embedded_leaf"] and
                         result["leaf_certificate_signature_valid_under_embedded_intermediate"] else 1)
    except (ValueError, OSError, ImportError) as exc:
        parser.exit(2, str(exc) + "\n")
