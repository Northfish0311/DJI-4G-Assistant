# DJI 4G Assistant（大疆 4G 助手）

DJI 4G Assistant（大疆 4G 助手）是一款 Windows 桌面管理软件，适用于第一代 DJI Cellular Dongle，以及部分 Baiwang / QDC507 / Quectel USB LTE 模块。

**当前主攻 Windows 版，不开发 Mac 版。** 手机和平板可以通过同一局域网访问 Windows 助手；模块仍插在 Windows 电脑上。

**iPhone / iPad 直插独立管理版尚未提供，当前暂停开发。** 已发布的实验性 iOS 远程客户端同样依赖 Windows，不能直接管理插在手机或平板上的模块。iOS 暂停新增开发和发布，已有资料仅供实验参考。

这是目前唯一维护的完整版本。

## 下载入口

**Windows v1.7.8：** 完成一次性声音设置后，在 Windows 本页拨打或接听会先准备临时驱动，接通后自动接入所选耳机/扬声器和麦克风；通话结束自动读取模块原因码。包含 v1.7.7 的下载、声卡识别、IMS 和实体 SIM 提示修复。稳定双向通话仍待实机验证，不保证所有运营商通话可用。先退出旧版，再安装新版。详情见[中文更新说明](docs/RELEASE-v1.7.8.md)。

| 设备 | 下载与使用 |
| --- | --- |
| Windows 电脑 | [Windows 版本](https://github.com/Northfish0311/DJI-4G-Assistant/releases/latest)，下载 `Setup-版本号-x64.exe` |
| 安卓手机/平板 | [下载安卓 0.2.0 测试版 APK](https://github.com/Northfish0311/DJI-4G-Assistant/releases/download/android-remote-v0.2.0/DJI-4G-Remote-Android-0.2.0-test.apk)，也可打开[安卓发布页](https://github.com/Northfish0311/DJI-4G-Assistant/releases/tag/android-remote-v0.2.0)。见[安卓中文说明](docs/Android使用说明.md) |
| iPhone/iPad | 可用 Safari 访问电脑助手；另有 [iOS 1.0.2 未签名远程测试版](https://github.com/Northfish0311/DJI-4G-Assistant/releases/tag/ios-remote-v1.0.2)。IPA 需有效签名后安装，TestFlight 尚未开放邀请 |

**手机和平板 App 都是远程管理版：模块插在 Windows，电脑保持运行，两台设备连接同一可信局域网。不是模块直插手机的独立版。**

## Windows 怎么用

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

程序识别到模块后，可在对应页面使用以下功能；收发短信、通话和上网还取决于 SIM 注册状态及套餐权限：

- **看短信：** 打开“短信”会自动读取，必要时点右上角圆形箭头刷新；旁边的暂停/继续按钮控制定时读取。鼠标停在图标上可看到名称。
- **发短信：** 点击“新建短信”填写号码和内容；回复已有会话时直接输入内容，再点击“发送短信”并确认。
- **接打电话：** 打开“电话”，输入真实号码后点“拨打”；来电时点“接听”。可分别选择 Windows 麦克风和扬声器；拨分机可输入 `主号,,分机#`，每个逗号等待 2 秒。
- **切换 eSIM：** 打开“eSIM”，在目标套餐上点击“切换到此套餐”并确认。程序随后只读核对当前 ICCID/IMSI，并区分“已切换”“网络注册中”和“卡号尚未变化”。
- **下载 eSIM：** 展开“下载新套餐”，粘贴套餐商给你的完整 `LPA:1$...` 激活码后确认。
- **检查 Windows 上网：** 打开“网络”，检查 USB 网卡、IPv4、网关和 DHCP；再到“概览”检查蜂窝注册状态。USB 网卡已连接不代表 SIM 已注册或互联网已经可用。

程序启动后会自动寻找模块、AT 端口和空闲网页端口，不需要手工填写 `COM5`。拨号、接听、挂断和刷新等日常操作直接执行；eSIM 删除、USB 模式、原始模块转换等高风险操作仍会要求确认。

### Edge 和 Windows 安全提醒

项目目前没有购买商业代码签名证书，因此 Edge 下载和 Windows 首次安装时可能显示安全提醒。请先确认下载地址属于本仓库，再按以下步骤操作：

1. Edge 提示文件“不常下载”时，选择“保留”；如果继续询问，选择“显示详细信息”或“仍然保留”。
2. Windows 显示“Windows 已保护你的电脑”时，选择“更多信息”，再选择“仍要运行”。
3. 如果文件不是从本仓库 Releases 下载，或者 SHA256 与发布页不一致，请停止安装并删除文件。

[详细中文使用说明](docs/使用说明.md) · [iOS 状态与实验性远程客户端](docs/iOS安装说明.md) · [硬件安全说明](docs/safety.md) · [安全策略](SECURITY.md)

## 一个程序包含的功能

- **设备发现**：USB 身份、COM 口、模块型号、SIM、运营商、信号、注册状态、APN、PDP、模块 IP 和支持设备的模块温度；AT 端口会优先按设备身份扫描并短暂重试。
- **局域网浏览器访问**：手机和平板可访问 Windows 程序的管理页面；模块必须插在 Windows 电脑上，电脑保持运行。
- **iPhone/iPad 远程客户端（实验性，暂停新增开发）**：已有版本通过局域网发现 Windows 主机、扫码配对并保存连接信息；同样依赖 Windows 主机。
- **网络面板**：Windows 网卡状态、IPv4、网关、DHCP、驱动版本和本次运行的收发流量；可修复已验证设备的 Windows ECM 驱动。
- **eSIM 管理**：自动发现并按 EID 去重多个 eUICC 空间，支持本地分类备注；在所选 EID 内列出 Profile、启用、停用、改昵称、下载、处理通知，并在双重确认后删除未启用 Profile。
- **短信**：读取收件箱、发送 UCS2/PDU 中文和长短信、提取常见 4–8 位验证码，并显示存储容量；满仓时可逐条确认删除。
- **电话**：监控来电、拨号、接听、挂断、来电号码和 DTMF，支持逗号延时分机号及 Windows 麦克风/扬声器分别选择；为精确匹配的 QDC507GLEFM21 提供带备份、读回和固定哈希验证的一次性 ADB/UAC 声音向导。
- **USSD**：发送余额或运营商服务代码。
- **AT 工具**：执行诊断指令，危险写入默认受限制。
- **USB 网卡模式**：对已验证的兼容设备切换 `usbnet=0/1`。
- **原始模块初始化**：对已验证的 `2CA3:4006` 先只读检查，再分两步转换为 `2C7C:0125 + usbnet=1`。
- **异常设备救援**：只读收集 USB、驱动、COM、网卡和 AT 基线。

## 电脑、手机和平板访问

Windows 本机直接使用桌面窗口。同一可信 Wi-Fi 下的手机、平板或其他电脑仍可使用浏览器访问“系统”页显示的局域网地址。

桌面版第一次运行会为当前 Windows 用户生成一个随机控制密码，并只保存在应用数据目录。它会在以后启动时继续使用，让 iPhone/iPad 配对一次后无需每次重扫。源码版 Start-Web-Console.cmd 仍为每次启动生成临时密码。

### 安卓远程管理

安卓 **0.2.0 远程测试版**支持保存多台电脑、搜索局域网电脑、损坏配对重置和有限自动重连；切回 App 不会自动刷新正常页面。已完成单元测试、静态检查和 Android 14 模拟器测试，真实手机扫码与模块操作仍需验证。最低 Android 7.0，下载 APK 安装后扫描电脑显示的配对码即可连接。[完整中文安装说明](docs/Android使用说明.md)。

这是调试签名测试包。若旧测试版提示签名冲突，需卸载旧版后重新安装并扫码，手机保存的配对信息会清除，不会删除模块里的套餐。**模块仍插在 Windows 电脑上，不是安卓 USB 直插版。配对后的新版管理页面由 Windows 1.7.4 提供，已有安卓 0.2.0 无需重装，重新连接即可。**

Windows 顶部的“连接手机 / 平板”二维码由 Android 和 iOS 客户端共用。网络、短信和 eSIM 能力由电脑助手提供；通话声音不传到安卓手机。

### iPhone / iPad 支持状态

实验性远程客户端 **1.0.2** 配合 Windows 1.7.4 使用新版手机/平板布局，并补充手动重载确认、HTTP 错误识别和有限重连保护。[中文更新说明](docs/RELEASE-ios-remote-v1.0.2.md) · [安装说明](docs/iOS安装说明.md)。通话声音仍在 Windows 电脑处理，不是 USB 直插独立管理版。

**TestFlight 尚未开放邀请，iOS 当前暂停新增开发和发布。** GitHub 的未签名 IPA 不是 TestFlight 安装包；普通用户可以直接用 Safari 访问 Windows 助手，无需安装实验性客户端。此前准备资料保留在 [TestFlight 说明](docs/TestFlight发布说明.md)。

| 使用方式 | 模块插在哪里 | 当前状态 |
| --- | --- | --- |
| 手机或平板浏览器远程管理 | Windows 电脑 | 已提供，电脑需保持运行 |
| iPhone/iPad App 远程管理 | Windows 电脑 | 已有实验性客户端，暂停新增开发 |
| iPhone/iPad App 直插独立管理 | iPhone 或 iPad | 尚未提供，暂停开发 |

**模块直插、独立管理：尚未实现，也没有可供普通用户安装的直插版 App。** iPhone 和 iPad 的设备访问能力需要分别验证，当前不承诺支持范围或完成时间。

现有 `ios/` 和 **Build iOS companion** 构建产物属于实验性远程客户端，管理的是插在 Windows 上的模块。Windows 必须保持运行；电话控制可远程操作，通话声音仍在 Windows 端处理。签名或安装这些产物不会增加模块直插管理能力。

普通用户远程管理可直接使用浏览器，无需安装上述实验客户端。开发测试步骤单独保留在 [iOS 状态与实验性远程客户端](docs/iOS安装说明.md)。模块直插后能够上网，不代表 App 已能读取短信、管理 eSIM 或接打电话。

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

网络页的“当前下载/上传”是连续采样计算的平均速度；首次读取会短暂显示“正在采样速度”。只统计当前 USB 网卡，不计入电脑 Wi-Fi 的流量，但包含与模块本地网关的通信。“本次下载/上传”从本次页面首次有效采样开始，重新打开页面、计数重置或统计来源变化时重新计数。模块直插手机或平板时的流量不在此统计范围内。Windows 性能计数只在网卡名称精确且唯一匹配时使用；无法取得可信计数时显示原因，不把未知数据显示成 0。
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

先展开“通话设置”，点击“刷新状态”。如果显示 **IMS 已关闭**，点击“启用 VoLTE”并确认。程序只为已验证的 QDC507GLEFM21 保存当前模块的 IMS 基线，然后启用 IMS、读回核对并重启；保留 APN、ECM、eSIM 套餐和运营商 MBN。需要撤销时点击“恢复 IMS 备份”。**语音配置开启不代表运营商注册或稳定通话已验证。**

1. 点击“下载语音文件”。程序只把固定 MaVo commit 的 6 个文件下载到本机，并逐个核对大小和 SHA-256，不会改模块。页面显示下载文件名与进度；连接失败可重试，已校验文件会保留复用。
2. 点击“打开 ADB 和声音”。程序重新读取型号、固件、IMEI 和七位 `usbcfg`，保存本地备份，保留 VID/PID 与已有 DIAG、NMEA、AT、Modem、ECM 功能，只把 ADB、UAC 两位设为 1。这个持久写入会再次确认并重启模块。
3. 如果页面显示“需要驱动”，从 [Zadig 官网](https://zadig.akeo.ie/) 打开工具，只给 `QDC507 ADB MI_06` 子接口绑定 WinUSB。不要替换复合设备本体、ECM 网卡、AT、NMEA、Modem 或音频接口。
4. 选择 Windows 麦克风和扬声器；使用耳机时选对应耳机，先调低系统音量。可点“准备通话声音”提前检查，也可以直接拨号或接听：程序先准备匹配临时驱动，接通后自动建立声音桥，不再每次要求另点“启动声音”。如果自动连接失败，页面显示错误，原“启动声音”按钮可手动重试。

“恢复最近 USB 备份”只对同一 IMEI 和 VID/PID 开放，会把七位 USB 配置恢复到写入前的精确值并重启模块。QADBKEY 授权本身可能是持久的，恢复 USB 位不能撤销它。

这个流程只对精确匹配的固件开放，不会套到未知模块。内核模块只临时加载，不写 boot、MTD、DIAG 或 EDL；模块重启后会清除。声音链路仍取决于运营商语音/VoLTE、模块 DSP 固件、Windows 音频设备和麦克风权限，首次请用短通话验证。局域网手机和平板能控制电话，但声音必须在插着模块的 Windows 电脑上启动。

普通实体 SIM 通常没有可管理的 EID。没有发现 eSIM 空间不影响网络、短信和电话入口；若插的是 eSIM 卡但入口未知，软件如实显示暂不支持，不猜测或切换私有空间。

通话结束时，软件只读查询 `AT+CEER` 与 IMS/LTE 状态，显示模块实际原因码，不把所有中断都当成“SIM 不支持”。有振铃、显示已接通和实际稳定双向声音是三个不同的验证阶段。自动声音只针对你在 Windows 本页发起或接听的通话；远程手机/平板不会因此承载 Windows USB 通话声音。

## 原始模块与风险

`2CA3:4006` 不是所有 DJI 模块必然相同的出厂身份。初始化功能先读取设备自己的 `ATI`、固件、`usbnet` 和 `usbcfg`，不会把网上固定参数盲写到未知设备。已经能够正常联网的模块不要执行初始化或恢复写入。

## 当前边界

- 当前以一台 Windows 电脑管理一个活动模块为主，多模块并发调度仍在计划中。
- VoHive 的代理池、Linux 网络命名空间和 VoWiFi/IMS 实验依赖 Linux 驱动及网络栈，当前 Windows 版不提供虚假按钮。
- 短信、USSD 和漫游数据最终取决于固件、运营商及套餐权限。
- 电话控制需要 SIM/套餐支持语音或 VoLTE；能拨号不等于一定有声音。QDC507 声音向导只在用户确认后修改 ADB/UAC，并按需临时加载固定哈希运行时；未知固件不会开放。该声音路线仍属实验功能。
- iPhone/iPad 直插独立管理尚未实现；现有实验性远程客户端依赖 Windows，通话声音也仍在 Windows 端处理。直接 USB 管理的可行性和设备支持范围需分别验证。
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

推送 `v*` 标签后，GitHub Actions 会自动构建 Windows 安装版、免安装版和 SHA256 校验文件。iOS 工作流仅构建实验性远程客户端，构建成功不表示支持模块直插。开发者测试见 [iOS 状态与实验性远程客户端](docs/iOS安装说明.md)。

## English

DJI 4G Assistant is the single maintained all-in-one Windows desktop app for compatible DJI Cellular Dongle, Baiwang/QDC507, and Quectel USB LTE devices. Download an installer or portable EXE from [Releases](https://github.com/Northfish0311/DJI-4G-Assistant/releases), plug in the device, and open the app. It detects the AT port and reads the basic device state automatically; **Auto Scan** is only needed when you want to run the checks again.

It includes diagnostics, Windows network and driver status, guarded official ECM driver repair, a dynamic multi-EID eSIM library, UCS2/PDU SMS with storage warnings and per-message deletion, call control, and an experimental guided QDC507GLEFM21 audio path. The audio setup pins and verifies an on-demand MaVo runtime, preserves existing USB functions, backs up and reads back `usbcfg`, and requires confirmation before enabling ADB/UAC. The experimental SwiftUI iPhone/iPad remote companion remains an ongoing development direction: it discovers the Windows host over Bonjour, pairs by QR code, stores the token in Keychain, and opens its management interface. The modem must be connected to Windows, which must remain running and handles USB call audio. A standalone app managing a modem plugged directly into an iPhone or iPad is a separate planned direction and is not implemented; device access and compatibility still need verification. Provider data allowance still requires a provider API.

## License

MIT. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
