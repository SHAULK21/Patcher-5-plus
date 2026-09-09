import hashlib
import streamlit as st

from verified_patcher import Mi5PlusPatcher

st.set_page_config(page_title="Xiaomi 5 Plus Firmware Studio", page_icon="🛴", layout="wide")
st.title("🛴 Xiaomi Electric Scooter 5 Plus — Verified Firmware Studio")
st.caption("Brightway / SZMC-ES-02664-LQ • evidence-first patching • CRC-16 • OTA extraction • mode XREF tracing")

with st.sidebar:
    uploaded = st.file_uploader("Загрузите OTA/BIN", type=["bin", "ota"])
    speed = st.slider("Speed patch (км/ч)", 1, 60, 35)
    extract = st.checkbox("После патча извлечь embedded MCU image", value=False)

if not uploaded:
    st.info("Загрузите исходный файл прошивки. Приложение не создаёт искусственный 64 KiB образ.")
    st.stop()

raw = uploaded.getvalue()
report = Mi5PlusPatcher.analyze(raw)

c1, c2, c3, c4 = st.columns(4)
c1.metric("Размер", f"{report['size']:,} B")
c2.metric("CRC", "OK" if report["crc_valid"] else "INVALID")
c3.metric("Speed hook", f"0x{report['speed_hook']:05X}" if report["speed_hook"] is not None else "—")
c4.metric("OTA trailer", f"0x{report['ota_trailer']:X}" if report["ota_trailer"] is not None else "—")

st.subheader("🔎 Firmware identity")
st.write({
    "SHA-256": report["sha256"],
    "known_reference": report["known_reference"],
    "marker_offset": report["marker_offset"],
    "stored_crc": f"0x{report['stored_crc']:04X}" if report["stored_crc"] is not None else None,
    "computed_crc": f"0x{report['computed_crc']:04X}" if report["computed_crc"] is not None else None,
})

st.subheader("⚡ Confirmed speed hook")
if report["speed_hook"] is not None:
    off = report["speed_hook"]
    st.code(f"file 0x{off:05X} / MCU 0x{0x08000000 + off:08X}\n"
            f"state: {report['speed_state']}\n"
            f"runtime speed RAM: 0x20000234\n"
            f"stock opcode: 78 7A\n"
            f"35 km/h opcode: 23 20")
else:
    st.error("Speed hook is missing or not unique; patch refused.")

st.subheader("🧭 Mode candidate / XREF")
st.write("0x200002DC is treated only as a candidate. Mode values are NOT labelled Eco/Drive/Sport until writers are traced.")
st.write(report["mode_xrefs"] or "No PC-relative literal XREF found")

st.subheader("🛠️ Patch")
if st.button(f"Патчить на {speed} км/ч", type="primary"):
    try:
        patched = Mi5PlusPatcher.patch_speed(raw, speed)
        patched_report = Mi5PlusPatcher.analyze(patched)
        st.success("Патч применён и CRC пересчитан.")
        st.write({
            "original_sha256": hashlib.sha256(raw).hexdigest(),
            "patched_sha256": hashlib.sha256(patched).hexdigest(),
            "crc_valid": patched_report["crc_valid"],
            "changed_bytes": 2,
        })
        output = patched
        if extract:
            output = Mi5PlusPatcher.extract_ota_image(patched)
            st.info(f"OTA trailer stripped; embedded image size: {len(output):,} bytes (0x{len(output):X}).")
        st.download_button("📥 Скачать результат", output, f"xiaomi_5plus_{speed}kmh.bin", "application/octet-stream")
    except Exception as exc:
        st.error(str(exc))

st.divider()
st.warning("Изменение прошивки и аппаратная прошивка могут привести к неработоспособности контроллера. Перед экспериментами сохраняйте полный заводской дамп. Полученный embedded image не объявляется доказанно flashable raw dump без отдельной проверки bootloader/addressing.")
