# 大疆 4G 助手 1.9.1 · Windows 64 位

先退出旧版。两个文件选一个即可，不需要安装 Node.js：
- [安装版（推荐）](https://github.com/Northfish0311/DJI-4G-Assistant/releases/download/v1.9.1/DJI-4G-Assistant-Setup-1.9.1-x64.exe)：双击安装，之后从开始菜单打开。
- [免安装版](https://github.com/Northfish0311/DJI-4G-Assistant/releases/download/v1.9.1/DJI-4G-Assistant-Portable-1.9.1-x64.exe)：双击直接运行。

## 这次改了什么

**网络页能看懂流量到底走哪了。**

原来「Windows 默认 IPv4 出口」只显示网卡名字。如果电脑上装了代理软件，那里可能显示成 `Meta` 这类名字，看不出流量是走模块、走 Wi-Fi 还是被代理接管。现在会在名字后面标出类型：

| 显示 | 含义 |
| --- | --- |
| `以太网 7 · 模块` | 流量走模块的卡 |
| `WLAN · Wi-Fi` | 走家里 Wi-Fi |
| `Meta · VPN/代理虚拟网卡` | 被代理接管，既不是模块也不是宽带 |
| `以太网 · 有线网卡` | 插网线 |

判定依据是网卡属性而不是名字：描述里出现 Quectel / ECM / Baiwang / WWAN 的算模块，`HardwareInterface = false` 的虚拟网卡算 VPN/代理，其余按 Wi-Fi 或有线归类。模块优先判定，插着时不会被误标。

其余功能与 1.9.0 相同。

## 验证方式

本机实测：接口返回 `names: ["WLAN"], kind: "wifi"`，页面显示「WLAN · Wi-Fi」；新增 3 个分类单元测试，全量 344 项通过。

## 验证边界

分类只依据网卡描述与硬件标志，**不检测代理软件是否真的在转发流量**；「电脑走 Wi-Fi 且收到新短信」的实机组合验证仍未完成。

Edge 或 Windows 可能提示文件不常见。请只从本仓库下载，无需关闭安全防护；可用同一发布页的 `SHA256SUMS.txt` 对照下载文件的 SHA256。
