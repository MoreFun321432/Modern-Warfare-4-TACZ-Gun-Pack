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

**1.8.2-Release 已经修复**，请先换到该版本。原因是枪包动画文件的问题，不是玩家环境：

GeckoLib 会扫描所有命名空间的 `animations/*.animation.json`，TACZ 枪包的动画也在其中。
GeckoLib 4.8.4 要求每个骨骼通道里**时间 0 的关键帧必须是第一个键**，而 1.8.1 及更早的
MCX 动画有 9 个通道把 0.0 排在最后，于是 GeckoLib 抛
`Invalid keyframe data - multiple starting keyframes`，整个资源重载失败，
游戏里就表现为**所有文字变成白框**。

如果你还在旧版本并遇到这个现象：

- 换用 1.8.2-Release（动画已修正）
- 用 `python tools/verify_gunpack_zip.py <枪包.zip>` 确认包内动画顺序正确
- 同时确认枪包放在 `.minecraft/tacz/`，不是 `.minecraft/resourcepacks/`

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
