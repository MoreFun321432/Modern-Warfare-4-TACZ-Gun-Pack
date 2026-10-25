# Modern Warfare 4 — TACZ Gun Pack

[![Website](https://img.shields.io/badge/website-repository--linked-c7f36b)](https://github.com/MoreFun321432/Modern-Warfare-4-TACZ-Gun-Pack/tree/main/web)
[![License: MIT](https://img.shields.io/badge/license-MIT-c7f36b)](./LICENSE)

Modern Warfare 4 是面向 Minecraft Forge 1.20.1 与 TACZ 的枪包，命名空间为
`mw4`。当前版本为 **1.8.0-Release**，包含 14 把枪、弹药、配件、换弹状态机和
仓库联动网页。

> Lite 包已冻结，本仓库只维护主包 `Modern Warfare 4`。仓库中的网页、API 和
> GitHub 工作流不会被打进 TACZ 枪包 zip。

## 枪械

| 类型 | 枪械 |
| --- | --- |
| 突击步枪 | AK-47、FN FAL、HK416D、M16A1、M4A1、SCAR-H、MCX SPEAR LT |
| 狙击/精准步枪 | AWP、MRAD、M700 |
| 轻机枪 | RPK |
| 战斗步枪 | HK G3 |
| 手枪 | 沙漠之鹰、HK MK23 |

枪包还包含 5.56×45mm、7.62×39mm、.308 Winchester、.338 Lapua Magnum、
.50 AE 和 .45 ACP 等弹药，以及 M700 瞄具和弹鼓配件。

## 安装

1. 从 [Releases](https://github.com/MoreFun321432/Modern-Warfare-4-TACZ-Gun-Pack/releases)
   下载 `Modern Warfare 4-<version>.zip`。
2. 把 zip 原样放进实例的 `.minecraft/tacz/` 目录，不要解压。
3. 启动游戏，或执行 `/tacz reload`。更新已加载的枪包时先完全退出游戏。

枪包以正式版 Forge 1.20.1 TACZ `1.1.8` 为语义基线。

## 仓库联动网页

`web/` 内是一个零运行时依赖的 Node.js 后端：

- 直接读取仓库内的 `gunpack_info.json`、枪械索引、语言文件和槽位图标。
- 通过 GitHub API 同步仓库状态、Stars、最近发布日期和 Release 下载资源。
- 提供枪包清单 API、图标 API 和最新版本下载跳转。
- 包含响应式中文展示页、健康检查、自动化测试和 Dockerfile。

从仓库根目录启动：

```powershell
node web/server.mjs
```

打开 `http://localhost:3000`。更多配置与部署方法见
[`web/README.md`](./web/README.md)。

可用环境变量：

- `PORT`：HTTP 端口，默认 `3000`
- `GITHUB_OWNER` / `GITHUB_REPO`：覆盖 `web/config.json` 中的仓库坐标
- `GITHUB_TOKEN`：可选，提高 GitHub API 匿名调用限额

## 目录

```text
assets/mw4/                模型、动画、贴图、音效、显示与语言文件
data/mw4/                  枪械数据、索引、配方、标签与 Lua 脚本
web/                       仓库联动网页与 Node.js 后端
.github/workflows/         网页后端 CI
```

## 开发校验

```powershell
node --test web/test/server.test.mjs
python tools\repack_main.py
```

`tools\repack_main.py` 会自动排除 `web/`、`.github/`、`.git/`、
`node_modules/` 和所有 `.bak*` 文件，确保网页源码不会混入 TACZ zip。

## License

仓库中的代码与文档使用 [MIT License](./LICENSE)。第三方游戏名称、模型、贴图、
音效及其他素材的权利仍归各自权利人所有。

