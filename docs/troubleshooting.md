# 故障排查

## 一、确认下载的包有没有损坏

先对一下 Release 页面「校验」里的 SHA-256，当前 1.8.1-Release 是：

```
4A2A142B3096144EDB09F8D4199F8610137892E865FC47F39CD7F8C3C7A62E69
```

Windows 上可以直接跑仓库里的脚本逐项检查（不用装任何东西）：

```
python tools/verify_gunpack_zip.py "Modern Warfare 4-1.8.1-Release.zip"
```

它会检查 zip 有没有坏块、关键文件是否齐全、所有动画 JSON 能不能解析，并单独比对 MCX 动画文件。

如果提示 MCX 动画不一致或 zip 有坏块，基本可以确定是下载或解压环节的问题：

- 重新下载，优先用 GitHub Release 附件，蓝奏云分流偶尔会被浏览器截断
- 用 7-Zip 或 WinRAR 完整解压，不要在压缩软件里直接预览、也不要只拖一部分文件出来
- 下载体积应该接近 25.0 MB（26,227,920 字节）

## 二、日志里提示动画文件损坏

本包的动画由 TACZ 自己解析，**不经过 GeckoLib**。所以日志里这类报错要看前缀：

```
software.bernie.geckolib ... Unable to parse animation: reload_tactical
```

这种来自**其它使用 GeckoLib 的模组或枪包**，不是 Modern Warfare 4 的问题。判断方法：看这条 ERROR 对应的 resource location，前缀是 `mw4:` 才与本包有关；是 `tacz:`、`mw19:`、`mw3:` 之类就与本包无关。

## 三、进游戏后文字全变成白框

这是**字体渲染失败**，不是枪包内容问题。本包是 TACZ 枪包，只包含 `assets/mw4/` 与 `data/mw4/`，
没有 `pack.mcmeta`、`assets/minecraft/` 或任何 `font` 文件，所以它**无法覆盖游戏字体**
（上面那条 `verify_gunpack_zip.py` 会直接把这一项列出来）。

常见真实原因，按出现频率排：

- 枪包被放进了 `resourcepacks/` 当成资源包加载，同时还有别的资源包一起覆盖字体
- 另一个资源包 / 汉化包提供了坏掉的字体（`assets/minecraft/font/default.json`）
- OptiFine 的字体设置（强制 Unicode、字体缩放）与其它模组冲突
- 内存不足，游戏构建字体图集失败 —— 这类通常伴随卡顿或贴图发白

排查顺序：

1. 确认枪包放的是 `.minecraft/tacz/`，不是 `.minecraft/resourcepacks/`
2. 依次只留一个资源包，找出是哪一个把字打坏
3. 关掉 OptiFine 的强制 Unicode 字体，或临时移除 OptiFine 验证
4. 给游戏分配更多内存后重开

## 四、GeckoLib 冲突

- TACZ 1.1.8 的 `mods.toml` 只依赖 Forge 与 Minecraft（外加可选的 Shoulder Surfing），**不依赖 GeckoLib**
- 同时装多个 GeckoLib（版本不同、或 1.21 的 jar 混进 1.20.1）会和其它用 GeckoLib 的模组冲突，表现就是那些模组的动画解析失败
- 处理：只保留一个与游戏版本匹配的 GeckoLib（1.20.1 对应 4.x），删掉重复 jar 后重启

## 五、MCX 动画文件基准值

需要单独核对时可以看这里，路径在 zip 内：

```
assets/mw4/animations/mcx_spear_lt.animation.json
```

- 大小：3,399,647 字节
- SHA-256：`FFA9E4DDB6CBF257E1CE9F3A80D71AC7F1E08A37E3EFEA749EEE4F6B458C1C14`
- 片段数：29

对不上就是文件在传输或解压时坏了，重新下载即可
