# SCAR-H Gun Pack（mw4）

使用你提供的三个 JSON 资产制作的完整 TACZ 枪包：

| 资产文件 | 用途 | 在枪包中的位置 |
| --- | --- | --- |
| `scar_h_geo.json` | SCAR-H 枪械模型（基岩版几何） | `assets/mw4/geo_models/gun/scar_h_geo.json` |
| `SCAR_H_animation.json` | SCAR-H 动画（19 个动作） | `assets/mw4/animations/scar_h.animation.json` |
| `556x45.json` | 5.56x45mm 弹药模型 | `assets/mw4/geo_models/ammo/556x45.json` |

## 内容

- 枪械 `mw4:scar_h`：5.56x45mm 口径、半自动/全自动、30 发弹匣（可装三级扩容弹匣），可安装瞄具/枪托/握把/枪口/镭射。
- 枪械 `mw4:hk416d`：5.56x45mm 口径、全自动/半自动、30 发弹匣，同样支持扩容/弹鼓。
- 弹药 `mw4:556x45`：堆叠 60，可合成。
- 配方：枪械与弹药均可通过枪械工作台合成（`data/mw4/recipes/`）。
- 配件标签：`data/mw4/tacz_tags/attachments/allow_attachments/scar_h.json` 声明可装配件类型（引用默认枪包的 `#tacz:scope` 等标签）。
- 状态机：复制自默认枪包（default_state_machine + 带扩容换弹逻辑的 xmag 状态机），已改为包内引用。
- 换弹逻辑：`data/mw4/scripts/xmag_reload_logic.lua` + 枪械数据中的 `script_param` 分级换弹时长。
- 弹鼓：新增专属配件 `mw4:drum_mag`（3 级扩容弹匣）。凡是 3 级弹匣（含默认的 `tacz:extended_mag_3`）都会播放 drum 动画（`reload_drum`、`reload_drum_empty`、`inspect_drum`、`inspect_drum_empty`）。

> 注意：弹鼓的**模型外观**不在配件的 JSON 里，而是由枪械模型的 `mag_extended_3` 骨骼控制（该骨骼目前只有少量细节方块）。如果你希望弹鼓在游戏里看起来是一个大鼓，需要用 Blockbench 在 `mag_extended_3` 骨骼（或新增的弹鼓骨骼）里补上弹鼓网格。

## 动画映射说明

你提供的动画文件使用 Blockbench 长名（`animation.raise` 等），TACZ 状态机要求短名，已自动重映射：

| 原动画名 | 映射后 | 用途 |
| --- | --- | --- |
| `animation.raise` | `draw` | 掏枪 |
| `animation.drop` | `put_away` | 收枪（挂起最后一帧） |
| `animation.reload` | `reload_tactical` | 战术换弹 |
| `animation.reload_empty` | `reload_empty` | 空仓换弹 |
| `animation.inspect` | `inspect` | 检视 |
| `animation.Inspect_empty` | `inspect_empty` | 空仓检视 |
| `animation.reload_xmag` | `reload_tactical_xmag` | 扩容弹匣战术换弹 |
| `animation.reload_empty_xmag` | `reload_empty_xmag` | 扩容弹匣空仓换弹 |
| `animation.Inspect_xmag` | `inspect_xmag` | 扩容弹匣检视 |
| `animation.inspect_empty_xmag` | `inspect_empty_xmag` | 扩容弹匣空仓检视 |

原文件中没有 `shoot`、`static_idle`、`aim` 等动画，display 中设置了 `"use_default_animation": "rifle"`，缺失动画会自动使用 TACZ 默认步枪动画。原文件中未使用的动画（drum 系列、`*_aim` 系列）保留未映射，不会影响加载。

## 贴图与音效

- 贴图：你未提供 PNG，枪包内生成了占位贴图（深色 + 网格的 UV 贴图、带文字的槽位/HUD 图标）。正式使用前请用你的贴图替换 `assets/mw4/textures/` 下的同名文件。
- 音效：暂时引用默认枪包（`tacz:scar_h/...`），也可以把自制的 `.ogg` 放进 `assets/mw4/tacz_sounds/scar_h/` 并修改 `display/guns/scar_h_display.json` 里的 `sounds`。

## 安装

把 `scar_h_gun_pack` 文件夹（或打包成 zip）放进 `.minecraft/tacz/` 目录即可，需要 TACZ 1.1.4 及以上版本。

## 常用调整位置

- 伤害/射速/弹容/后坐力：`data/mw4/data/guns/scar_h_data.json`
- 模型/贴图/动画/音效引用：`assets/mw4/display/guns/scar_h_display.json`
- 弹药参数：`assets/mw4/display/ammo/556x45_display.json`
- 弹鼓容量：`data/mw4/data/guns/scar_h_data.json` 的 `extended_mag_ammo_amount` 第 3 项（当前 40 发）
- 合成配方：`data/mw4/recipes/`
- 名称与描述：`assets/mw4/lang/`
