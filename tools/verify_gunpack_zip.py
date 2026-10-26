#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验下载到的枪包 zip 是否完整（玩家 / 维护者都能跑）。

用法:
    python tools/verify_gunpack_zip.py "Modern Warfare 4-1.8.0-Release.zip"

检查项:
  1. zip 的 CRC 是否全部通过（截断 / 坏块会在这里暴露）
  2. 关键文件是否齐全
  3. 所有 .animation.json 是否能正常解析
  4. MCX 动画文件的大小与 SHA-256 是否与 1.8.0-Release 发布版一致

只依赖标准库，不需要装任何东西。
"""

import hashlib
import json
import os
import sys
import zipfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 1.8.1-Release 的基准值（来自 GitHub Release 附件）
EXPECTED_ZIP_SHA256 = "4A2A142B3096144EDB09F8D4199F8610137892E865FC47F39CD7F8C3C7A62E69"
KNOWN_ZIP_SHA256 = {
    "1.8.1-Release": EXPECTED_ZIP_SHA256,
    "1.8.0-Release": "AB53282FD70EDE2D2E3CA8A44556B020D2DA94636AC5584C697A6AB976E6B831",
}
MCX_ANIM = "assets/mw4/animations/mcx_spear_lt.animation.json"
EXPECTED_MCX_SIZE = 3399647
EXPECTED_MCX_SHA256 = "FFA9E4DDB6CBF257E1CE9F3A80D71AC7F1E08A37E3EFEA749EEE4F6B458C1C14"

REQUIRED = (
    "assets/mw4/gunpack_info.json",
    MCX_ANIM,
    "assets/mw4/display/guns/mcx_spear_lt_display.json",
    "assets/mw4/geo_models/gun/mcx_spear_lt_geo.json",
    "data/mw4/data/guns/mcx_spear_lt_data.json",
    "data/mw4/index/guns/mcx_spear_lt.json",
)


def main():
    if len(sys.argv) < 2:
        print("用法: python tools/verify_gunpack_zip.py <枪包.zip>")
        return 2
    path = sys.argv[1]
    if not os.path.exists(path):
        print("[X] 找不到文件:", path)
        return 2

    problems = []
    size = os.path.getsize(path)
    digest = hashlib.sha256(open(path, "rb").read()).hexdigest().upper()
    print("文件:", path)
    print("大小:", size, "字节")
    print("SHA-256:", digest)
    if digest == EXPECTED_ZIP_SHA256:
        print("  [OK] 与 1.8.1-Release 发布附件完全一致")
    elif digest in KNOWN_ZIP_SHA256.values():
        old = [v for v, h in KNOWN_ZIP_SHA256.items() if h == digest][0]
        print("  [注] 这是 %s 的包（可正常使用，但建议换成 1.8.1-Release）" % old)
    else:
        print("  [注] 与已知的发布附件不同（如果你下的是其它版本可忽略）")

    try:
        z = zipfile.ZipFile(path)
    except Exception as e:
        print("[X] 不是有效的 zip:", e)
        return 1

    bad = z.testzip()
    if bad:
        problems.append("zip 内部 CRC 校验失败（文件损坏），损坏项: %s" % bad)
    else:
        print("  [OK] zip 结构完整，没有坏块")

    names = set(z.namelist())
    miss = [n for n in REQUIRED if n not in names]
    if miss:
        problems.append("缺少关键文件: %s" % miss)
    else:
        print("  [OK] 关键文件齐全（%d 个条目）" % len(names))

    if MCX_ANIM not in names:
        problems.append("找不到 MCX 动画文件")
    else:
        raw = z.read(MCX_ANIM)
        h = hashlib.sha256(raw).hexdigest().upper()
        print("  MCX 动画: %d 字节 / %s" % (len(raw), h))
        if len(raw) == EXPECTED_MCX_SIZE and h == EXPECTED_MCX_SHA256:
            print("  [OK] MCX 动画与发布版一致")
        else:
            problems.append("MCX 动画与发布版不一致（多半是下载/解压损坏）")
        try:
            clips = json.loads(raw.decode("utf-8"))["animations"]
            print("  [OK] MCX 动画 JSON 可解析，共 %d 个片段" % len(clips))
        except Exception as e:
            problems.append("MCX 动画 JSON 解析失败: %s" % e)

    broken = []
    for n in names:
        if n.endswith(".animation.json"):
            try:
                json.loads(z.read(n).decode("utf-8"))
            except Exception as e:
                broken.append("%s (%s)" % (n, e))
    if broken:
        problems.append("这些动画文件解析失败: %s" % broken[:5])
    else:
        ok = len([n for n in names if n.endswith(".animation.json")])
        print("  [OK] %d 个动画文件全部可解析" % ok)

    print()
    if problems:
        print("结论: 有问题 %d 项" % len(problems))
        for p in problems:
            print("  [X]", p)
        print("处理: 重新下载（优先 GitHub Release 附件），用 7-Zip 完整解压后再试")
        return 1
    print("结论: 文件完整，可以正常使用")
    return 0


if __name__ == "__main__":
    sys.exit(main())
