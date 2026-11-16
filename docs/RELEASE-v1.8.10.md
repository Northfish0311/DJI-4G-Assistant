# 大疆 4G 助手 1.8.10 · Windows 64 位

先退出旧版。两个文件选一个即可，不需要安装 Node.js：
- [安装版（推荐）](https://github.com/Northfish0311/DJI-4G-Assistant/releases/download/v1.8.10/DJI-4G-Assistant-Setup-1.8.10-x64.exe)：双击安装，之后从开始菜单打开。
- [免安装版](https://github.com/Northfish0311/DJI-4G-Assistant/releases/download/v1.8.10/DJI-4G-Assistant-Portable-1.8.10-x64.exe)：双击直接运行。

## 这次修了什么

- **关掉窗口后程序必须真的退出**：以前点关闭按钮，窗口消失但后台仍留着一组进程（主程序、渲染、GPU、工具进程），再打开又会多一组，只能在任务管理器里手动结束。现在关闭窗口会结束整组进程；万一某个子进程卡住，1.5 秒后也会强制结束，不再残留。
- 顺带修正第二次启动的处理：程序已在运行时再双击图标，新进程立即退出，以前可能短暂残留。

其余功能与 1.8.9 相同。

## 验证方式

在 1.8.10 源码上实测：启动后有 6 个进程，点关闭后 1 秒内全部退出（`Get-Process electron` 返回 0）。单元测试全部通过。

## 验证边界

退出行为在开发模式下实测；打包版（安装版/免安装版）沿用同一份 `desktop/main.js`，但未逐版本复核。「电脑走 Wi-Fi 且收到新短信」的实机组合验证仍未完成。

Edge 或 Windows 可能提示文件不常见。请只从本仓库下载，无需关闭安全防护；可用同一发布页的 `SHA256SUMS.txt` 对照下载文件的 SHA256。
