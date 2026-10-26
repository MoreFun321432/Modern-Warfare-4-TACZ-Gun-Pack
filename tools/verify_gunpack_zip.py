#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验下载到的枪包 zip 是否完整（玩家 / 维护者都能跑）。

用法:
    python tools/verify_gunpack_zip.py "Modern Warfare 4-1.8.2-Release.zip"

检查项:
  1. zip 的 CRC 是否全部通过（截断 / 坏块会在这里暴露）
  2. 关键文件是否齐全
  3. 所有 .animation.json 是否能正常解析
  4. MCX 动画文件的大小与 SHA-256 是否与 1.8.2-Release 发布版一致

只依赖标准库，不需要装任何东西。
"""

import hashlib
import json
import os
import sys
import zipfile

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# 1.8.2-Release 的基准值（来自 GitHub Release 附件）
EXPECTED_ZIP_SHA256 = "7CCB54500A7E1E4579FEB9B9784019E2E5E0381C6596CD04B2FED9B46DE0CCE6"
KNOWN_ZIP_SHA256 = {
    "1.8.2-Release": EXPECTED_ZIP_SHA256,
    "1.8.1-Release": "4A2A142B3096144EDB09F8D4199F8610137892E865FC47F39CD7F8C3C7A62E69",
    "1.8.0-Release": "AB53282FD70EDE2D2E3CA8A44556B020D2DA94636AC5584C697A6AB976E6B831",
}
MCX_ANIM = "assets/mw4/animations/mcx_spear_lt.animation.json"
EXPECTED_MCX_SIZE = 3399647
EXPECTED_MCX_SHA256 = "CCE012C12AC9C83B9CCE8244C8FD8AAFC0056537230916C813067C99772A2BC1"

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
        print("  [OK] 与 1.8.2-Release 发布附件完全一致")
    elif digest in KNOWN_ZIP_SHA256.values():
        old = [v for v, h in KNOWN_ZIP_SHA256.items() if h == digest][0]
        print("  [注] 这是 %s 的包（建议换成 1.8.2-Release）" % old)
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

    # 本包是 TACZ 枪包，只应有 assets/mw4 与 data/mw4。
    # 一旦出现资源包级别的文件（pack.mcmeta、assets/minecraft/**、font），
    # 被当成资源包加载时可能覆盖游戏字体，表现就是文字全变白框。
    risky = sorted(
        n for n in names
        if n == "pack.mcmeta"
        or n.startswith("assets/minecraft/")
        or "/font/" in n
        or n.startswith("font/")
    )
    if risky:
        problems.append("包里出现资源包级别文件（可能导致字体异常）: %s" % risky[:5])
    else:
        print("  [OK] 不含 pack.mcmeta / assets/minecraft / font，不会覆盖游戏字体")

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
    bad_order = []
    for n in names:
        if n.endswith(".animation.json"):
            try:
                data = json.loads(z.read(n).decode("utf-8"))
            except Exception as e:
                broken.append("%s (%s)" % (n, e))
                continue
            # GeckoLib 4.8.4 要求每个通道的 0.0 关键帧必须是第一个键，
            # 否则整份动画解析失败 → 资源重载失败 → 游戏文字全变白框
            for clip in (data.get("animations") or {}).values():
                for chans in (clip.get("bones") or {}).values():
                    for track in chans.values():
                        if not isinstance(track, dict):
                            continue
                        for i, k in enumerate(track):
                            try:
                                t = float(k)
                            except (TypeError, ValueError):
                                t = 0.0
                            if t == 0.0 and i != 0:
                                bad_order.append("%s: %s" % (n, list(track)[:3]))
                                break
    if broken:
        problems.append("这些动画文件解析失败: %s" % broken[:5])
    elif bad_order:
        problems.append("动画关键帧顺序不符合 GeckoLib 要求（0.0 必须在第一位）: %s"
                        % bad_order[:3])
    else:
        ok = len([n for n in names if n.endswith(".animation.json")])
        print("  [OK] %d 个动画文件全部可解析，关键帧顺序符合 GeckoLib 要求" % ok)

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
