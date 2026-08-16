# DJI 4G Assistant（大疆 4G 助手）

DJI 4G Assistant（大疆 4G 助手）是面向 Windows 的一体化桌面管理工具，适用于第一代 DJI Cellular Dongle，以及部分 Baiwang / QDC507 / Quectel USB LTE 模块。

这是目前唯一维护的完整版本。

## 普通用户怎么用

1. 打开 [Releases](https://github.com/Northfish0311/DJI-4G-Assistant/releases)，找到最上方带 **Latest** 标记的版本。
2. 只下载 `DJI-4G-Assistant-Setup-版本号-x64.exe`，这是普通用户使用的安装版。
3. 双击下载的安装包，按提示完成安装。
4. 把 SIM/eSIM 卡装进模块，再把模块插到 Windows 电脑。
5. 双击桌面上的 **DJI 4G Assistant** 图标。
6. 点击右上角“自动扫描”。

Releases 页面中的文件用途如下：

| 文件 | 用途 | 是否需要下载 |
| --- | --- | --- |
| `DJI-4G-Assistant-Setup-版本号-x64.exe` | 正式安装版，会创建桌面和开始菜单快捷方式 | **普通用户下载这个** |
| `DJI-4G-Assistant-Portable-版本号-x64.exe` | 不安装，下载后直接双击运行，适合临时测试或放在 U 盘 | 可选 |
| `.exe.blockmap`（旧版发布页可能出现） | 打包工具生成的数据文件，不能单独运行；新版不再发布 | **不要下载** |
| `SHA256SUMS.txt` | 验证安装包是否完整、是否被替换 | 可选 |
| `Source code (zip)` / `Source code (tar.gz)` | GitHub 自动生成的开发者源码压缩包，不是软件 | **普通用户不要下载** |

看到“已联网”、运营商、信号和模块 IP 后，就可以直接使用：

- **看短信：** 打开“短信”，点击“刷新”。
- **发短信：** 在“短信”右侧填写号码和内容，点击“发送短信”并确认。
- **切换 eSIM：** 打开“eSIM”，在目标套餐上点击“切换到此套餐”并确认，等待网络重新注册。
- **下载 eSIM：** 展开“下载新套餐”，粘贴套餐商给你的完整 `LPA:1$...` 激活码后确认。
- **检查 Windows 上网：** 打开“网络”，确认网卡为“已连接”，并看到 IPv4、网关和 DHCP。

程序会自动寻找模块和空闲端口。每个写入动作都会再次确认，不点击就不会修改模块。

### Edge 和 Windows 安全提醒

项目目前没有购买商业代码签名证书，因此 Edge 下载和 Windows 首次安装时可能显示安全提醒。请先确认下载地址属于本仓库，再按以下步骤操作：

1. Edge 提示文件“不常下载”时，选择“保留”；如果继续询问，选择“显示详细信息”或“仍然保留”。
2. Windows 显示“Windows 已保护你的电脑”时，选择“更多信息”，再选择“仍要运行”。
3. 如果文件不是从本仓库 Releases 下载，或者 SHA256 与发布页不一致，请停止安装并删除文件。

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

eSIM 页会分别显示当前卡的 EID、卡内 Profile 数、剩余存储空间，以及 GSMA SM-DS 中可领取的待下载套餐。Profile 列表包含当前 EID 内标准接口可读到的已启用和已停用套餐。

如果套餐商 App 显示三份套餐，而这里显示一份，不代表网页漏读。请先比较套餐商 App 与本页 EID；尚未下载到这张卡的订单、属于另一 EID 的套餐，以及厂商没有按标准 Profile 暴露的 bootstrap 身份，都不会出现在卡内 Profile 列表。可点击“检查待下载”查询 SM-DS，或使用套餐商提供的完整 LPA 激活码下载。

套餐剩余流量通常保存在套餐商账户服务器中，不在 eUICC Profile 标准字段里。因此仅凭卡片无法可靠显示 Airalo、Roamless、RedteaGO 等套餐余额，需要分别接入套餐商官方 API。当前网络面板只显示 Windows 实际收发量，不冒充运营商余额。

## Windows 原生模式与 VoHive 模式

| 用途 | 模块模式 | 电脑侧接口 |
| --- | --- | --- |
| Windows 直接联网和使用本软件 | `usbnet=1`（ECM） | Quectel ECM 有线网卡 |
| Linux / VoHive | `usbnet=0`（QMI） | `qmi_wwan` / `cdc-wdm` |

两种网络模式不能同时工作。切换 `usbnet` 会重启并重新枚举模块；Windows 用户保持 `usbnet=1`，只有明确准备把模块交给 Linux/VoHive 时才切到 `usbnet=0`。

排错按固定顺序进行：先看 USB 身份，再看 COM/AT 口，然后检查 SIM、LTE 注册、PDP，最后检查 Windows ECM 网卡、DHCP、IPv4 和网关。前一层未通过时，不要重复写 VID/PID、APN 或 `usbnet`。

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

## 相关路线与致谢

本项目是 Windows 原生桌面方案，不需要 WSL、Hyper-V 或 Linux 虚拟机。需要 VoHive 时，可参考：

- [wlzh/dji-4g-vohive-mac](https://github.com/wlzh/dji-4g-vohive-mac)：macOS + UTM + Linux USB 直通路线。
- [LeiyuG/dji-vohive-hyperv](https://github.com/LeiyuG/dji-vohive-hyperv)：Windows + Hyper-V + usbipd-win 路线。
- [estkme-group/lpac](https://github.com/estkme-group/lpac)：本项目 eUICC Profile 读取与管理所使用的开源 LPA。

本项目独立实现，没有复制上述项目或 VoHive 的代码；文档吸收了它们在模式选择、重新枚举和逐层排错方面的公开经验。

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

DJI 4G Assistant is the single maintained all-in-one Windows desktop app for compatible DJI Cellular Dongle, Baiwang/QDC507, and Quectel USB LTE devices. Download an installer or portable EXE from [Releases](https://github.com/Northfish0311/DJI-4G-Assistant/releases), plug in the device, and select **Auto Scan**.

It includes diagnostics, Windows network and driver status, guarded installation of the verified official Quectel ECM driver for the exact `2C7C:0125 / MI_04` interface, multi-profile eSIM management, UCS2/PDU SMS, OTP extraction, USSD, guarded AT tools, verified USB mode switching, original `2CA3:4006` setup, and read-only rescue diagnostics. Provider data allowance requires a provider API.

## License

MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
