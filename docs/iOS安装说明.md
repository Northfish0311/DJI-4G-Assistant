# iPhone / iPad 远程管理（实验性）

当前更新为 [v1.0.2 未签名测试版](https://github.com/Northfish0311/DJI-4G-Assistant/releases/tag/ios-remote-v1.0.2)。**未签名 IPA 不能直接安装，也不是 TestFlight 邀请。** 建议先把 Windows 助手更新到 1.7.4；已安装旧 iOS 远程 App 的用户，重新连接即可看到新版管理页面。客户端本身的重载确认和错误恢复修复，需要更新 iOS App。

**后续主要安装方式：TestFlight。** 目前正在准备发布条件，尚无邀请链接。开放后用户通过 Apple 官方 TestFlight 接受邀请并安装，不用自己给 IPA 签名。见 [TestFlight 安装与发布](TestFlight发布说明.md)。下文侧载步骤仅保留给开发测试者。

## 先看这一段

这是电脑助手的手机和平板遥控端，不是模块直插手机的驱动。模块插在 Windows 上，电脑助手保持运行；手机和平板连接同一可信局域网后扫码配对。日常使用不需要把模块改成其他 USB 模式。

首次安装 App 仍需要有效签名。没有已签名 App 时，可以先在 Safari 打开电脑助手显示的局域网管理地址，不必为了网页管理安装 App。不要输入手机自己的 `127.0.0.1`。

## v1.0.2 改进

- 配合 Windows 1.7.4，手机使用五个底部入口，iPad 使用左侧导航；短信可在列表和正文间返回，eSIM 空间、拨号盘和实时流量重新排版。配对页仍使用原生 iOS 控件。
- 在正常页面点“更多 → 重新载入”会先确认，提醒未发送短信和未保存输入将丢失；取消就留在原页面。正常切回 App 不主动刷新页面。
- 页面加载失败最多自动重试三次，间隔为 2、4、8 秒；切回前台不会重置重试次数。主页面返回 401/403 时停止自动重试并提示授权错误，不把错误页面显示成“已连接”。这些检查针对页面加载，不代表模块已经注册网络。
- 重新连接和退出时解除旧网页的回调，避免旧页面覆盖新的连接状态。不会自动重发短信、删除或切换套餐。
- 支持网页的确认、提示和文字输入弹窗，包括 eSIM 分类备注；危险操作的确认不会被跳过。
- 附近电脑条目中的箭头可填入手动配对地址，仍需要有效配对密码。
- 忘记电脑前再次确认；网页使用临时存储，控制密码继续由 Keychain 保存。
- 配对校验拒绝 HTTP 重定向，避免控制密码被转发到其他地址。局域网 HTTP 不等于加密连接，只应在可信网络使用。

Windows 本机不能运行 Xcode；发布流程使用云端 Mac 编译，运行配对解析与连接恢复策略单元测试，并生成 iPhone/iPad 配对页截图。只有该次构建成功后才发布测试包；源码或模拟器测试不代表真机功能已验证。真机还需验证扫码、首次网络权限、睡眠恢复、电脑离线、确认/取消操作及密码失效。

直插独立版的设备范围、签名条件及真实验证步骤，见 [iPad 直插开发状态](iPad直插开发状态.md)。当前没有可下载安装的直插版。

**模块直插 iPhone / iPad、无需 Windows 的独立管理 App 尚未实现。** 这是后续需要验证的目标，不是当前版本已有功能。现有 `ios/` 源码和 iOS 构建产物均不具备该能力。

远程客户端会继续开发完善，直插独立版也保留为后续方向。前者用于从手机或平板管理电脑连接的模块，后者目标是离开电脑使用；两者分别说明进度，不以远程客户端的完成代替直插版。

本文只供开发者测试已有的实验性远程客户端。它通过局域网连接 Windows 主机，扫码配对后显示管理界面，控制密码保存在 Apple Keychain。模块必须插在 Windows 电脑上，电脑保持运行。普通 Windows 用户无需安装它；手机和平板远程访问可使用浏览器。

## 先理解连接方式

~~~text
DJI 4G 模块 -> Windows 电脑上的 DJI 4G Assistant -> 同一 Wi-Fi -> iPhone / iPad App
~~~

Windows 电脑仍负责 USB、AT 串口、lpac 和通话音频。iPhone/iPad 负责显示和控制，所以 Windows 程序必须保持运行。

模块直插独立管理需要另行验证 iPhone 和 iPad 的设备接口访问能力、权限与硬件兼容性，尚未确定支持范围或发布时间。不能把某些设备直插能够上网，或远程客户端编译成功，当作直接读取短信、管理 eSIM 或接打电话已经可用的证据。

## 真机安装为什么多一步

Apple 要求 iPhone/iPad App 必须经过有效代码签名。仓库没有保存任何人的 Apple 证书、私钥或账号，所以 GitHub 自动构建的是：

| 文件 | 用途 |
| --- | --- |
| **DJI-4G-Assistant-iOS-Unsigned.ipa** | 真机程序，但尚未签名；需要用你自己的 Apple ID 或开发者证书签名后安装 |
| **DJI-4G-Assistant-iOS-Simulator.zip** | 只给 Mac 上的 iOS Simulator 测试，不能安装到真实 iPhone/iPad |
| **DJI-4G-Assistant-iOS-SHA256SUMS.txt** | 校验上面两个文件是否完整 |

普通开发测试者从 [v1.0.2 发布页](https://github.com/Northfish0311/DJI-4G-Assistant/releases/tag/ios-remote-v1.0.2)的 **Assets** 下载。GitHub Actions 的绿色 **Build iOS companion** 任务也保留同一构建的 Artifact；日常源码构建不自动发布，必须显式触发发布流程。

## 开发测试：安装远程客户端

以下仅为实验性远程客户端的签名测试步骤；完成安装后仍需 Windows 主机。可使用 [Sideloadly 官方网站](https://sideloadly.io/)提供的 Windows 工具，用自己的 Apple ID 给未签名 IPA 签名：

1. 打开 [iOS v1.0.2 发布页](https://github.com/Northfish0311/DJI-4G-Assistant/releases/tag/ios-remote-v1.0.2)。
2. 展开 **Assets**，下载 **DJI-4G-Assistant-iOS-Unsigned.ipa**，不要选 Simulator.zip 或 Source code。
3. 从 [Sideloadly 官网](https://sideloadly.io/)下载安装工具，不要使用网盘或第三方修改版。
4. 用 USB 线连接 iPhone/iPad，在设备上选择“信任此电脑”。
5. 把 **DJI-4G-Assistant-iOS-Unsigned.ipa** 拖进 Sideloadly，选择自己的设备和 Apple ID 后开始安装。
6. 按 iOS 提示启用“开发者模式”，并信任自己的开发者签名。
7. 免费 Apple 账号签名可能需要定期刷新；以 Sideloadly 和当前 iOS 的实际提示为准。

Apple ID 和密码只应输入你自己选择的签名工具，绝对不要发到本项目 Issue、聊天、二维码或配置文件中。本项目不会收集或保存 Apple 账号。

更稳定的公开安装方式是 TestFlight 或 App Store，但需要 Apple Developer Program 账号、App Store Connect 配置和 Apple 审核。

## 第一次配对

1. 在 Windows 上安装并打开最新 DJI 4G Assistant。
2. 插好模块，确认 Windows 程序可以读取设备。
3. 让 Windows 电脑和 iPhone/iPad 连接同一可信 Wi-Fi。
4. 点击 Windows 顶部的“连接手机 / 平板”。
5. 在 iOS App 中点击“扫描配对码”，允许相机和本地网络权限。
6. 扫描 Windows 显示的二维码。看到管理界面后即完成。

App 会通过 Bonjour 自动发现 **_dji4g._tcp** 服务。桌面版控制密码按当前 Windows 用户持久保存，因此电脑或 App 重启后通常不需要重新扫码；点击 iOS App 中的“忘记这台电脑”会清除 Keychain 中的密码。

## 能做与不能做

可以：

- 在 iPhone/iPad 查看模块状态、运营商、信号和 Windows 网卡。
- 读取和发送短信。
- 管理当前接口能够访问的全部 EID 与 eSIM Profile。
- 拨号、接听、挂断和发送 DTMF。
- 执行 Windows 控制台已经开放且经过确认的操作。

当前不能：

- 模块直插 iPhone/iPad 后独立管理短信、eSIM、网络或电话。
- 把 Windows USB 通话声音直接送到 iPad。电话可以远程控制，但声音仍在插着模块的 Windows 电脑上处理。
- 在 Windows 程序关闭、电脑休眠或不在同一可达局域网时继续管理模块。
- 绕过 Apple 代码签名直接安装 IPA。

## 安全

- 配对二维码内含局域网地址和控制密码，拿到二维码的人可能控制模块。
- 只在可信局域网扫码，不要截图公开，不要把管理端口映射到公网。
- iOS App 只接受私有局域网地址或 .local 主机名，控制密码保存在 Keychain。
- Windows 的 Bonjour 广播不包含控制密码，真正的二维码 API 仍需已认证访问。
- 短信、EID、ICCID、IMSI、IMEI 和激活码都属于敏感信息。

## 开发者构建

需要 macOS、Xcode 和 [XcodeGen](https://github.com/yonaskolb/XcodeGen)：

~~~bash
cd ios
xcodegen generate
open DJI4GAssistant.xcodeproj
~~~

在 Xcode 的 Signing & Capabilities 中选择自己的 Team，然后连接 iPhone/iPad 运行。仓库的 GitHub Actions 会分别编译 iPhone/iPad 模拟器和未签名真机架构。
