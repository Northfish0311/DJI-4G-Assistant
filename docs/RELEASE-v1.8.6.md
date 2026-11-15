# DJI 4G Assistant 1.8.6 · Windows 64 位

## 下载与升级

| 你想怎么用？ | 下载哪个？ | 下载后怎么做？ |
| --- | --- | --- |
| 经常使用，希望有桌面图标 | [安装版 Setup（推荐）](https://github.com/Northfish0311/DJI-4G-Assistant/releases/download/v1.8.6/DJI-4G-Assistant-Setup-1.8.6-x64.exe) | 先退出旧助手，双击安装包，按提示安装。 |
| 临时使用，或希望放在 U 盘 | [免安装版 Portable](https://github.com/Northfish0311/DJI-4G-Assistant/releases/download/v1.8.6/DJI-4G-Assistant-Portable-1.8.6-x64.exe) | 先退出旧助手，双击这个文件就能运行。 |

两者功能一样，只选一个，不要同时打开。无需安装 Node.js，也不用输入命令。GitHub 页面上的 `Source code` 是给开发者看的，不是安装包。

## 这次改了什么

- **发短信能看清结果。** 只有模块返回短信编号并最终确认，才显示已提交；这不是对方的送达回执。若模块明确拒绝，会显示原始错误码；若中途断开、结果不确定，会保留草稿，不自动重发。长短信会显示确认了几段，避免误发两遍。
- **看短信少等一步。** 宽窗口左边选会话、右边看正文；窄窗口点会话看正文，点返回箭头回列表。切换会话或搜索不再反复解析同一批短信；换卡或内容变化会更新。
- **网络页照常采样，减少重复刷新。** 网卡名称和流量文字没变时不再反复重写。这改善的是界面，不会改变 SIM 套餐或提高 4G 网速。

本版没有改变模块的 USB 模式、APN 或 eSIM 配置。短信发送流程使用模拟串口覆盖了正常确认、拒绝和中断；这不等于已验证某个运营商的实际送达。通话声音仍是实验功能。

## 下载安全

只从[本项目的 GitHub 发布页](https://github.com/Northfish0311/DJI-4G-Assistant/releases/tag/v1.8.6)下载。Edge 或 Windows 可能提示文件不常见；不必关闭安全防护。需要核对时，下载 [SHA256SUMS.txt](https://github.com/Northfish0311/DJI-4G-Assistant/releases/download/v1.8.6/SHA256SUMS.txt)，在下载文件夹中对你选的文件运行 `Get-FileHash -Algorithm SHA256 .\文件名.exe`，对照同名文件那一行；不一致就不要运行。
