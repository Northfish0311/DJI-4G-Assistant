# DJI 4G Assistant（大疆 4G 助手）

DJI 4G Assistant（大疆 4G 助手）是一套 Windows 主机程序与原生 iPhone/iPad 客户端，适用于第一代 DJI Cellular Dongle，以及部分 Baiwang / QDC507 / Quectel USB LTE 模块。

这是目前唯一维护的完整版本。

## 普通用户怎么用

1. 打开 [Releases](https://github.com/Northfish0311/DJI-4G-Assistant/releases)，找到最上方带 **Latest** 标记的版本。
2. 只下载 `DJI-4G-Assistant-Setup-版本号-x64.exe`，这是普通用户使用的安装版。
3. 双击下载的安装包，按提示完成安装。
4. 把 SIM/eSIM 卡装进模块，再把模块插到 Windows 电脑。
5. 双击桌面上的 **DJI 4G Assistant** 图标。
6. 等待程序自动发现 AT 口并读取设备状态；只有需要重新检查时才点击右上角“自动扫描”。

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
- **发短信：** 点击“新建短信”填写号码和内容；回复已有会话时直接输入内容，再点击“发送短信”并确认。
- **接打电话：** 打开“电话”，输入真实号码后点“拨打”；来电时点“接听”。精确匹配的 QDC507 可按页面完成一次性声音设置，以后接通后点“启动声音”。
- **切换 eSIM：** 打开“eSIM”，在目标套餐上点击“切换到此套餐”并确认，等待网络重新注册。
- **下载 eSIM：** 展开“下载新套餐”，粘贴套餐商给你的完整 `LPA:1$...` 激活码后确认。
- **检查 Windows 上网：** 打开“网络”，确认网卡为“已连接”，并看到 IPv4、网关和 DHCP。

程序启动后会自动寻找模块、AT 端口和空闲网页端口，不需要手工填写 `COM5`。拨号、接听、挂断和刷新等日常操作直接执行；eSIM 删除、USB 模式、原始模块转换等高风险操作仍会要求确认。

### Edge 和 Windows 安全提醒

项目目前没有购买商业代码签名证书，因此 Edge 下载和 Windows 首次安装时可能显示安全提醒。请先确认下载地址属于本仓库，再按以下步骤操作：

1. Edge 提示文件“不常下载”时，选择“保留”；如果继续询问，选择“显示详细信息”或“仍然保留”。
2. Windows 显示“Windows 已保护你的电脑”时，选择“更多信息”，再选择“仍要运行”。
3. 如果文件不是从本仓库 Releases 下载，或者 SHA256 与发布页不一致，请停止安装并删除文件。

[详细中文使用说明](docs/使用说明.md) · [iPhone/iPad 安装说明](docs/iOS安装说明.md) · [硬件安全说明](docs/safety.md) · [安全策略](SECURITY.md)

## 一个程序包含的功能

- **设备发现**：USB 身份、COM 口、模块型号、SIM、运营商、信号、注册状态、APN、PDP 和模块 IP。
- **iPhone/iPad 原生客户端**：Bonjour 自动发现 Windows 主机、系统相机扫码配对、Keychain 保存控制密码，并以原生导航打开完整管理界面。
- **网络面板**：Windows 网卡状态、IPv4、网关、DHCP、驱动版本和本次运行的收发流量；可修复已验证设备的 Windows ECM 驱动。
- **eSIM 管理**：自动发现并按 EID 去重多个 eUICC 空间，支持本地分类备注；在所选 EID 内列出 Profile、启用、停用、改昵称、下载、处理通知，并在双重确认后删除未启用 Profile。
- **短信**：读取收件箱、发送 UCS2/PDU 中文和长短信、提取常见 4–8 位验证码，并显示存储容量；满仓时可逐条确认删除。
- **电话**：监控来电、拨号、接听、挂断、来电号码和 DTMF；为精确匹配的 QDC507GLEFM21 提供带备份、读回和固定哈希验证的一次性 ADB/UAC 声音向导。
- **USSD**：发送余额或运营商服务代码。
- **AT 工具**：执行诊断指令，危险写入默认受限制。
- **USB 网卡模式**：对已验证的兼容设备切换 `usbnet=0/1`。
- **原始模块初始化**：对已验证的 `2CA3:4006` 先只读检查，再分两步转换为 `2C7C:0125 + usbnet=1`。
- **异常设备救援**：只读收集 USB、驱动、COM、网卡和 AT 基线。

## 电脑、手机和平板访问

Windows 本机直接使用桌面窗口。同一可信 Wi-Fi 下的手机、平板或其他电脑仍可使用浏览器访问“系统”页显示的局域网地址。

桌面版第一次运行会为当前 Windows 用户生成一个随机控制密码，并只保存在应用数据目录。它会在以后启动时继续使用，让 iPhone/iPad 配对一次后无需每次重扫。源码版 Start-Web-Console.cmd 仍为每次启动生成临时密码。

### iPhone / iPad 原生 App

1. 让 Windows 电脑和 iPhone/iPad 连接同一可信 Wi-Fi。
2. 保持 Windows DJI 4G Assistant 运行，点击顶部“连接 iPhone / iPad”。
3. 在 iOS App 中点击“扫描配对码”，允许相机和本地网络权限。
4. 扫描电脑显示的二维码，即可管理短信、eSIM、网络、电话和诊断。
5. App 会把密码保存在 Apple Keychain；选择“忘记这台电脑”可清除。

原生 App 的源码位于 **ios/**，GitHub 的绿色 **Build iOS companion** 工作流会生成模拟器包和明确标注的未签名真机 IPA。Apple 要求真机 App 必须签名，普通 Windows 用户可用自己的 Apple ID 通过 Sideloadly 签名测试；模拟器 ZIP 不能安装到真实设备。完整步骤见 [iPhone/iPad 安装说明](docs/iOS安装说明.md)。

iOS App 管理的是插在 Windows 上的模块。Windows 必须保持运行；拨号、接听等控制可远程操作，但 USB 通话声音仍在 Windows 电脑上处理。模块直插 iPad 后读取 AT/eSIM 仍需要 Apple 批准的 DriverKit 路线，当前没有冒充支持。

**127.0.0.1** 永远表示当前设备自己，不能把电脑上的本机地址原样输入手机。不要把管理端口映射到公网或无认证隧道。

## 多张 EID、eSIM 套餐和流量

### 支持哪些卡

**本项目只处理标准入口和已经适配的厂商入口。未知私有入口不猜、不自动切底层芯片。** 不保证所有品牌、所有“双芯片 / 双 EID”卡都能读全。当前已经用 ESTK 双 EID 卡实测两个空间及其中的套餐；适配规则不包含某个用户的卡号或 EID，换另一张兼容卡会读取它自己的信息。

- **已读取**：该 EID 成功返回了套餐列表。列表为空才显示 0 个套餐。
- **读取失败**：通信或列表查询没有成功，不能据此说卡里没有套餐。先确认模块连接、串口没有被其他软件占用。
- **暂不支持**：卡片需要本项目尚未适配的管理入口或私有芯片切换方式。程序不会为了试读而重置卡片、猜测指令或修改网络模式。

只读到一个 EID 时，页面显示的是“本次已读到一个”，不代表这张卡只能有一个。普通实体 SIM 没有 eSIM 套餐库，也不能按多 EID 卡管理。

### 最简单的用法

1. 插上模块，打开 Windows 软件，等待自动识别。无需填写 COM 口或 AID。
2. 点击 **eSIM**，选择要查看的卡片空间。这个动作只切换页面的管理目标，不会切套餐。
3. 使用某个套餐时，点击 **切换到此套餐**，核对目标后确认。改名、卡号、删除放在 **更多操作与卡号** 中。
4. 首页可以直接进入短信、电话、eSIM、网络。进入短信页会开启定时读取；接打电话的声音仍受设备和运营商能力限制，不能承诺首次插入就有声音。
5. 保持软件运行。检测到串口变化或 SIM 标识变化后，会清除上一张卡的页面数据并重新读取。后台窗口恢复前台后继续检测；暂时的通信失败不会被当作“卡片已空”。必要时可手动点击 **自动扫描**。

删除套餐、下载套餐、改 USB 模式等仍保留明确确认；自动识别不执行这些写操作。

打开软件的 **eSIM** 页，点击 **刷新全部 EID**。程序会分别查询 ESTK 的 **SE0、SE1** 专用入口，以及标准入口、已知兼容入口和本机验证过的私有入口。扫描期间请等候，不要同时用其他工具占用模块串口。

每个读到的 EID 单独显示，下面是该空间内已启用和未启用的套餐。可点击空间的 **管理** 查看套餐，再点击 **改名** 标为“长期卡”或“测试卡”。选中一个空间仅改变管理目标，不会自动启用它的套餐；切换套餐仍须点击套餐按钮并确认。

“已读取套餐列表 2/2”表示本次发现的两个 EID 都成功返回了列表；“套餐未读取”表示查询失败，不等于空卡。只有成功返回空列表才显示 0 个套餐。同一个 EID 通过多个入口返回时会合并，不会重复算成多张卡。界面展示实际读取结果，不保证发现卡片所有隐藏空间。

分类备注只保存在本机 `.local` 目录，不会写入 eSIM 卡。如果卡内有第三个或更多空间，数量不会被限制为两个，但仍须使用标准或已有适配入口。高级区域的私有 AID 选项是历史诊断功能，不属于普通用户流程，不代表对未知厂商或隐藏空间的兼容承诺。

ESTK SE0/SE1 的协议标识来自 [ESTK 官方 OpenEUICC 厂商定义](https://github.com/estkme-group/openeuicc/blob/master/app-common/src/main/java/im/angry/openeuicc/util/Vendors.kt)。本项目独立实现扫描流程，使用原有 lpac；双空间改动已增加模拟测试，具体卡片与固件仍需实测。

需要注意：多 SE/eUICC 卡的其他空间如果被厂商私有切换器隐藏，Windows 模块只暴露一个入口时，软件不能安全地靠猜测找出其余 EID。此时页面会如实显示已访问数量，不会执行来源不明的切卡写指令。套餐商 App 中的订单、尚未下载的套餐和 bootstrap 身份也不等于可管理的 EID/Profile。

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


## QDC507 接打电话和声音

拨号、接听、挂断、来电号码和 DTMF 仍使用 AT 指令，不需要开启 ADB。双向声音是另一条链路，本版本为已验证的 `QDC507 / QDC507GLEFM21` 增加了引导式实验功能。

第一次使用声音时，在“电话”页按顺序操作：

1. 点击“下载运行时”。程序只把固定 MaVo commit 的 6 个文件下载到本机，并逐个核对大小和 SHA-256，不会改模块。
2. 点击“打开 ADB 和声音”。程序重新读取型号、固件、IMEI 和七位 `usbcfg`，保存本地备份，保留 VID/PID 与已有 DIAG、NMEA、AT、Modem、ECM 功能，只把 ADB、UAC 两位设为 1。这个持久写入会再次确认并重启模块。
3. 如果页面显示“需要驱动”，从 [Zadig 官网](https://zadig.akeo.ie/) 打开工具，只给 `QDC507 ADB MI_06` 子接口绑定 WinUSB。不要替换复合设备本体、ECM 网卡、AT、NMEA、Modem 或音频接口。
4. 可点“准备通话声音”提前检查，也可以直接拨号。以后每次模块重启后，通话接通再点“启动声音”，程序会自动把匹配驱动临时加载到内存并建立 Windows 麦克风、扬声器和模块 UAC 之间的桥接。

“恢复最近 USB 备份”只对同一 IMEI 和 VID/PID 开放，会把七位 USB 配置恢复到写入前的精确值并重启模块。QADBKEY 授权本身可能是持久的，恢复 USB 位不能撤销它。

这个流程只对精确匹配的固件开放，不会套到未知模块。内核模块只临时加载，不写 boot、MTD、DIAG 或 EDL；模块重启后会清除。声音链路仍取决于运营商语音/VoLTE、模块 DSP 固件、Windows 音频设备和麦克风权限，首次请用短通话验证。局域网手机和平板能控制电话，但声音必须在插着模块的 Windows 电脑上启动。

## 原始模块与风险

`2CA3:4006` 不是所有 DJI 模块必然相同的出厂身份。初始化功能先读取设备自己的 `ATI`、固件、`usbnet` 和 `usbcfg`，不会把网上固定参数盲写到未知设备。已经能够正常联网的模块不要执行初始化或恢复写入。

## 当前边界

- 当前以一台 Windows 电脑管理一个活动模块为主，多模块并发调度仍在计划中。
- VoHive 的代理池、Linux 网络命名空间和 VoWiFi/IMS 实验依赖 Linux 驱动及网络栈，当前 Windows 版不提供虚假按钮。
- 短信、USSD 和漫游数据最终取决于固件、运营商及套餐权限。
- 电话控制需要 SIM/套餐支持语音或 VoLTE；能拨号不等于一定有声音。QDC507 声音向导只在用户确认后修改 ADB/UAC，并按需临时加载固定哈希运行时；未知固件不会开放。该声音路线仍属实验功能。
- 原生 iPhone/iPad 客户端可以扫码管理插在 Windows 上的模块，但声音桥接仍只能在 Windows 本机启动。模块直插 iPad 后管理通用 USB AT/eSIM 仍需要 Apple 批准的 DriverKit 驱动扩展。
- 本项目独立实现，没有复制 DJOneHub、VoHive 或 NetXD 的代码。

## 相关路线与致谢

本项目是 Windows 原生桌面方案，不需要 WSL、Hyper-V 或 Linux 虚拟机。需要 VoHive 时，可参考：

- [wlzh/dji-4g-vohive-mac](https://github.com/wlzh/dji-4g-vohive-mac)：macOS + UTM + Linux USB 直通路线。
- [LeiyuG/dji-vohive-hyperv](https://github.com/LeiyuG/dji-vohive-hyperv)：Windows + Hyper-V + usbipd-win 路线。
- [estkme-group/lpac](https://github.com/estkme-group/lpac)：本项目 eUICC Profile 读取与管理所使用的开源 LPA。
- [cr-zhichen/DJOneHubNative](https://github.com/cr-zhichen/DJOneHubNative)：QDC507 模块研究与公开行为参考。
- [moluncn/mavo](https://github.com/moluncn/mavo)：按固定 commit 下载并校验的可选 QDC507 语音运行时来源。
- [Zadig](https://zadig.akeo.ie/) / [libwdi](https://github.com/pbatard/libwdi)：Windows ADB 子接口的 WinUSB 工具。

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

推送 `v*` 标签后，GitHub Actions 会自动构建 Windows 安装版、免安装版和 SHA256 校验文件。iOS 工作流使用 macOS/Xcode 编译模拟器与未签名真机架构；开发者可在 macOS 中进入 `ios` 目录运行 `xcodegen generate`，再选择自己的 Apple Team 签名。

## English

DJI 4G Assistant is the single maintained all-in-one Windows desktop app for compatible DJI Cellular Dongle, Baiwang/QDC507, and Quectel USB LTE devices. Download an installer or portable EXE from [Releases](https://github.com/Northfish0311/DJI-4G-Assistant/releases), plug in the device, and open the app. It detects the AT port and reads the basic device state automatically; **Auto Scan** is only needed when you want to run the checks again.

It includes diagnostics, Windows network and driver status, guarded official ECM driver repair, a dynamic multi-EID eSIM library, UCS2/PDU SMS with storage warnings and per-message deletion, call control, and an experimental guided QDC507GLEFM21 audio path. The audio setup pins and verifies an on-demand MaVo runtime, preserves existing USB functions, backs up and reads back `usbcfg`, and requires confirmation before enabling ADB/UAC. The native SwiftUI iPhone/iPad companion discovers the Windows host over Bonjour, pairs by QR code, stores the token in Keychain, and opens the complete management surface. The Windows host still carries USB audio and must remain running. Direct generic USB modem access on iPadOS remains a separate Apple DriverKit entitlement path. Provider data allowance still requires a provider API.

## License

MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
