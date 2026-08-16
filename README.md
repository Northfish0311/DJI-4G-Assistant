# DJI RoamDock

DJI RoamDock 是面向 Windows 的一体化桌面管理工具，适用于第一代 DJI Cellular Dongle，以及部分 Baiwang / QDC507 / Quectel USB LTE 模块。

这是目前唯一维护的完整版本。普通用户不需要安装 Node.js，也不需要打开黑色命令窗口。

## 下载与使用

1. 打开 [Releases](https://github.com/Northfish0311/DJI_RoamDock-Pro-for-Windows/releases)。
2. 下载 `DJI-RoamDock-Setup-...exe`（安装版，推荐）或 `DJI-RoamDock-Portable-...exe`（免安装版）。
3. 插入模块，打开 DJI RoamDock。
4. 点击“自动扫描”。

程序会自动寻找可用端口；即使 `8787` 已被占用，也会继续尝试其他端口。

> 首个公开版本尚未购买 Windows 代码签名证书。请只从本仓库 Releases 下载并核对 SHA256；Windows SmartScreen 首次运行时可能显示提示。

[详细中文使用说明](docs/使用说明.md) · [硬件安全说明](docs/safety.md) · [安全策略](SECURITY.md)

## 一个程序包含的功能

- **设备发现**：USB 身份、COM 口、模块型号、SIM、运营商、信号、注册状态、APN、PDP 和模块 IP。
- **网络面板**：Windows 网卡状态、IPv4、网关、DHCP、驱动版本和本次运行的收发流量；可修复已验证设备的 Windows ECM 驱动。
- **eSIM 管理**：列出多张 Profile，启用、停用、改昵称、下载、处理通知，以及双重确认后删除未启用的 Profile。
- **短信**：读取收件箱、发送 UCS2/PDU 中文和长短信，并提取常见 4–8 位验证码。
- **USSD**：发送余额或运营商服务代码。
- **AT 工具**：执行诊断指令，危险写入默认受限制。
- **USB 网卡模式**：对已验证的兼容设备切换 `usbnet=0/1`。
- **原始模块初始化**：对已验证的 `2CA3:4006` 先只读检查，再分两步转换为 `2C7C:0125 + usbnet=1`。
- **异常设备救援**：只读收集 USB、驱动、COM、网卡和 AT 基线。

## 电脑、手机和平板访问

Windows 本机直接使用桌面窗口。同一可信 Wi-Fi 下的手机、平板或其他电脑，可以打开“系统”页显示的局域网地址，并输入本次启动自动生成的临时控制台密码。

`127.0.0.1` 永远表示当前设备自己，不能把电脑上的 `http://127.0.0.1:8787` 原样输入手机。不要把管理端口映射到公网或无认证隧道。

## 多张 eSIM 和套餐流量

DJI RoamDock 会列出 lpac 从当前 eUICC 实际读取到的全部 Profile，并允许切换。

套餐剩余流量通常保存在套餐商账户服务器中，不在 eUICC Profile 标准字段里。因此仅凭卡片无法可靠显示 Airalo、Roamless、RedteaGO 等套餐余额，后续需要分别接入套餐商官方 API。当前网络面板显示 Windows 实际收发量，不冒充运营商余额。

## Windows ECM 驱动修复

当模块已经是 `2C7C:0125 + usbnet=1`、蜂窝侧已联网，但 Windows 仍显示网卡断开或拿不到 IPv4 时，打开“网络”页检查驱动。仅当程序精确发现 `USB\VID_2C7C&PID_0125&MI_04` 时，才会开放“安装或修复官方驱动”。

确认后，程序会请求 Windows 管理员授权，从 Quectel 官方地址下载 ECM V1.0 驱动包，核对内置 SHA256 和数字签名，备份当前 Quectel 驱动，再安装已验证的 `Quectel ECM Adapter 19.0.33.201`。项目仓库和安装包不内置该驱动。驱动已正确安装时按钮只检查状态，不重复修改；目标接口不存在、校验失败或签名无效时立即停止。

## 原始模块与风险

`2CA3:4006` 不是所有 DJI 模块必然相同的出厂身份。初始化功能先读取设备自己的 `ATI`、固件、`usbnet` 和 `usbcfg`，不会把网上固定参数盲写到未知设备。已经能够正常联网的模块不要执行初始化或恢复写入。

## 当前边界

- 当前以一台 Windows 电脑管理一个活动模块为主，多模块并发调度仍在计划中。
- VoHive 的代理池、Linux 网络命名空间和 VoWiFi/IMS 实验依赖 Linux 驱动及网络栈，当前 Windows 版不提供虚假按钮。
- 短信、USSD 和漫游数据最终取决于固件、运营商及套餐权限。
- 本项目独立实现，没有复制 DJOneHub、VoHive 或 NetXD 的代码。

## 从源码运行和构建

只有开发者需要安装 [Node.js LTS](https://nodejs.org/)。

```powershell
npm install
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\install-lpac.ps1
npm test
npm run desktop
npm run build
```

推送 `v*` 标签后，GitHub Actions 会自动构建安装版、免安装版和 SHA256 校验文件。

## English

DJI RoamDock is the single maintained all-in-one Windows desktop app for compatible DJI Cellular Dongle, Baiwang/QDC507, and Quectel USB LTE devices. Download an installer or portable EXE from [Releases](https://github.com/Northfish0311/DJI_RoamDock-Pro-for-Windows/releases), plug in the device, and select **Auto Scan**.

It includes diagnostics, Windows network and driver status, guarded installation of the verified official Quectel ECM driver for the exact `2C7C:0125 / MI_04` interface, multi-profile eSIM management, UCS2/PDU SMS, OTP extraction, USSD, guarded AT tools, verified USB mode switching, original `2CA3:4006` setup, and read-only rescue diagnostics. Provider data allowance requires a provider API.

## License

MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
