"""Exercise pairing UI without connecting to a modem or sending requests."""

import pathlib
import re
import subprocess
import time
import xml.etree.ElementTree as ET

APP = "com.northfish0311.dji4gremote"
OUTPUT = pathlib.Path("android/screenshots")
UI_DUMP = "/data/local/tmp/dji4g-pairing-ui.xml"


def adb(*args):
    return subprocess.check_output(["adb", *args], timeout=30)


def nodes():
    adb("shell", "uiautomator", "dump", UI_DUMP)
    return list(ET.fromstring(adb("shell", "cat", UI_DUMP)).iter("node"))


def find(text):
    for _ in range(4):
        matches = [node for node in nodes() if node.get("text") == text]
        if matches:
            return matches[0]
        time.sleep(1)
    raise AssertionError("UI text missing: " + text)


def tap(text):
    node = find(text)
    assert node.get("enabled") == "true", "Control disabled: " + text
    left, top, right, bottom = map(int, re.findall(r"\d+", node.get("bounds")))
    assert right > left and bottom > top, "Empty control: " + text
    adb("shell", "input", "tap", str((left + right) // 2), str((top + bottom) // 2))


def capture(name):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / name).write_bytes(adb("exec-out", "screencap", "-p"))


def launch():
    adb("shell", "am", "force-stop", APP)
    adb("shell", "am", "start", "-W", "-n", APP + "/.MainActivity")
    find("扫描配对码")


def main():
    launch()
    tap("手动连接")
    find("收起手动连接")
    find("电脑地址")
    capture("phone-manual.png")
    # Empty input is rejected locally, without contacting a computer.
    tap("连接电脑")
    find("收起手动连接")
    if not any("局域网" in node.get("text", "") for node in nodes()):
        raise AssertionError("Invalid input did not show the address error")
    capture("phone-validation.png")
    tap("收起手动连接")
    find("手动连接")
    if any(node.get("text") == "电脑地址" for node in nodes()):
        raise AssertionError("Manual fields remained visible after collapse")
    original_scale = adb("shell", "settings", "get", "system", "font_scale").decode().strip()
    try:
        adb("shell", "settings", "put", "system", "font_scale", "1.3")
        launch()
        capture("phone-large-text.png")
        tap("手动连接")
        find("收起手动连接")
        capture("phone-large-text-manual.png")
    finally:
        if original_scale == "null":
            adb("shell", "settings", "delete", "system", "font_scale")
        else:
            adb("shell", "settings", "put", "system", "font_scale", original_scale)
    print("Pairing UI checks passed: expand, validation, collapse, large text")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        try:
            capture("pairing-failure.png")
        except Exception:
            pass
        raise
