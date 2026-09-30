import json
import streamlit as st
from verified_patcher import Mi5PlusPatcher

st.set_page_config(page_title="Xiaomi 5 Plus — strict patcher", page_icon="🛴")
st.title("Xiaomi 5 Plus — строгий патчер")
st.warning("Результат — исследовательский OTA-пакет. Аппаратная прошивка, подпись OTA и соответствие параметра физическим км/ч не подтверждены.")
uploaded = st.file_uploader("Полный оригинальный OTA", type=["bin", "ota"])
value = st.number_input("Значение параметра (1–60)", min_value=1, max_value=60, value=35, step=1)
st.caption("KERS заблокирован: по 0x5C9E находится STRB r2,[r0,r1]. Экспорт raw flash image отключён.")
if uploaded:
    raw = uploaded.getvalue()
    analysis = Mi5PlusPatcher.analyze(raw)
    st.json(analysis)
    try:
        Mi5PlusPatcher.validate_reference(raw)
    except ValueError as exc:
        st.error(str(exc))
        st.stop()
    if st.button("Проверить и применить патч"):
        try:
            output = Mi5PlusPatcher.patch_speed(raw, int(value))
            report = Mi5PlusPatcher.verify_output(raw, output, int(value))
            st.success("Инструкция изменена, CRC проверен. Совместимость с прошивальщиком не установлена.")
            st.json(report)
            st.download_button("Скачать исследовательский пакет", output,
                               f"xiaomi_5plus_parameter_{value}.research.bin", "application/octet-stream")
            st.download_button("Скачать отчёт", json.dumps(report, indent=2),
                               "patch-report.json", "application/json")
        except ValueError as exc:
            st.error(str(exc))
