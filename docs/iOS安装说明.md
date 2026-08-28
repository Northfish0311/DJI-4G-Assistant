# iPhone / iPad 原生客户端安装说明

DJI 4G Assistant 现在包含一个真正的 SwiftUI iOS / iPadOS 客户端。它会在同一局域网自动发现 Windows 主机，通过系统相机扫码配对，并把控制密码保存在 Apple Keychain。配对一次后，App 可打开完整的短信、eSIM、网络、电话和诊断界面。

## 先理解连接方式

~~~text
DJI 4G 模块 -> Windows 电脑上的 DJI 4G Assistant -> 同一 Wi-Fi -> iPhone / iPad App
~~~

Windows 电脑仍负责 USB、AT 串口、lpac 和通话音频。iPhone/iPad 负责显示和控制，所以 Windows 程序必须保持运行。

这不是“把普通 USB 模块直接插到 iPad 后读取 AT 串口”的 DriverKit 版本。直接 USB 驱动仍需要 Apple 授予 DriverKit entitlement、专门的驱动扩展和实机审核；当前 App 不会尝试绕过 iOS 权限。

## 真机安装为什么多一步

Apple 要求 iPhone/iPad App 必须经过有效代码签名。仓库没有保存任何人的 Apple 证书、私钥或账号，所以 GitHub 自动构建的是：

| 文件 | 用途 |
| --- | --- |
| **DJI-4G-Assistant-iOS-Unsigned.ipa** | 真机程序，但尚未签名；需要用你自己的 Apple ID 或开发者证书签名后安装 |
| **DJI-4G-Assistant-iOS-Simulator.zip** | 只给 Mac 上的 iOS Simulator 测试，不能安装到真实 iPhone/iPad |
| **DJI-4G-Assistant-iOS-SHA256SUMS.txt** | 校验上面两个文件是否完整 |

GitHub Actions 的最新绿色 **Build iOS companion** 任务会生成这些文件。它们暂时作为 Actions Artifact 保存，不会在没有确认的情况下自动发布到 Releases。

## Windows 用户安装到 iPhone / iPad

当前最直接的测试方式是使用 [Sideloadly 官方网站](https://sideloadly.io/)提供的 Windows 工具，用自己的 Apple ID 给未签名 IPA 签名：

1. 在仓库的 **Actions** 页面打开最新成功的 **Build iOS companion**。
2. 下载页面底部的 **DJI-4G-Assistant-iOS** Artifact 并解压。
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
4. 点击 Windows 顶部的“连接 iPhone / iPad”。
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

- 模块直插 iPad 后直接读取通用 USB AT 串口。
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
