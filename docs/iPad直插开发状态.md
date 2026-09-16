# iPad 直插独立版：开发状态与前置条件

核对日期：2026-09-16。

**当前没有可用的直插独立版。本文不是安装教程，也不表示 USB 驱动已经完成。** 现有 `ios/` 仍是远程客户端，模块必须插在 Windows 上。它会继续保留。

## 我们要做什么

模块直接插在 iPad 上，由 App 读取网络状态、短信和 eSIM 信息，不依赖运行中的 Windows 电脑。先验证真实 USB 通信，再开放套餐切换、短信发送等写操作；不能用模拟数据或远程接口代替验证。

## 哪些设备有开发路线

| 设备 | 已核实的路线 | 尚未证明的部分 |
| --- | --- | --- |
| M 系列 iPad，包括 M4 iPad | iPadOS DriverKit / USBDriverKit 自定义驱动 | 本模块 AT 接口能否成功绑定、收发，以及与系统网卡驱动共存 |
| iPhone | 没有相同的 DriverKit 路线 | 尚未找到适用于本模块、已经验证的直接管理入口 |

有 USB-C 接口或可以通过模块上网，不代表 App 可以访问 USB AT 控制口。不能把 M4 iPad 的可开发性推广成所有 iPhone/iPad 都支持。

## 当前缺什么

当前用户环境只有 Windows 和 iPhone/iPad。检查本机未发现 Xcode 或 Swift 编译工具，尚未取得有效的驱动签名配置，也未运行真机 USB 驱动测试。

- 需要 macOS / Xcode 构建环境；云端 Mac 可以承担编译，但不能代替本地真机调试与验收。
- 需要相应的 Apple 开发团队、App 和驱动签名及 provisioning 配置。开发与分发的权限要求不同，不能笼统声称开发前所有 entitlement 都要单独审批；对外分发须按 Apple 当时的要求申请。
- iPad 用户需要在系统设置中启用驱动。不能承诺首次安装完全无需授权。
- 普通侧载签名不会凭空获得 USB 驱动权限。不能把已有远程客户端的未签名 IPA 当成直插驱动版。

暂不建议为了尚未验证的功能购买设备或开发者会员，也不要在聊天或仓库中提交 Apple 密码、签名私钥或证书。

## 实现与验收顺序

1. 只读取得实际模块的 USB 描述符，确认 AT 子接口及端点；不把所有同 VID/PID 设备当成同一硬件。
2. 独立建立 iPad App 与 USBDriverKit 驱动目标。只绑定经过确认的 AT 子接口，不抢占复合设备、ECM 网卡、音频或其他接口。
3. 完成签名并在 M4 iPad 上启用驱动，验证插拔、断开恢复、超时和接口占用处理。
4. 第一项硬件验收仅发送 `AT` 和 `ATI` 等只读查询，核对真实响应，并确认原有联网功能仍正常。
5. 实现串行命令队列与异步通知解析，再做短信读取和 eSIM 标准/已适配厂商入口枚举。未知私有入口明确显示暂不支持，不猜测或自动切底层芯片。
6. 在只读链路稳定后增加经确认的写入功能。通话控制和双向声音独立验收；能拨号不等于已有声音。

替代研究方向是模块本身通过 USB 网卡提供经过认证的管理服务，再由手机/平板 App 访问。但目前没有确认这块模块提供这样的接口；部署服务可能需要改动模块固件，不能静默安装或开放无认证的网络 AT 端口。

## 官方依据

- [Creating drivers for iPadOS](https://developer.apple.com/documentation/driverkit/creating-drivers-for-ipados)
- [USBDriverKit](https://developer.apple.com/documentation/usbdriverkit)
- [Requesting Entitlements for DriverKit Development](https://developer.apple.com/documentation/driverkit/requesting-entitlements-for-driverkit-development)
- [Bring your driver to iPad with DriverKit](https://developer.apple.com/videos/play/wwdc2022/110373/)
- [App 与 DriverKit 驱动通信示例](https://developer.apple.com/documentation/driverkit/communicating-between-a-driverkit-extension-and-a-client-app)
