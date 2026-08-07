# DJI RoamDock Pro for Windows

> **完整功能版 / Full version:** Use this project for a new or original `2CA3:4006` module, or when you need module conversion, SMS sending, and full diagnostics. For an already converted `2C7C:0125 + usbnet=1` module that only needs basic management, use [DJI RoamDock Lite for Windows](https://github.com/Northfish0311/DJI_RoamDock-Lite-for-Windows).

A native Windows control hub for the first-generation DJI Cellular Dongle and compatible Baiwang / QDC507 / Quectel USB LTE modules. It runs on the Windows PC and provides a bilingual Chinese/English web console. Use it directly in a browser on the Windows PC, or optionally from a phone, tablet, or another computer on the same LAN.

It is a local tool, not a shared website. Every computer starts its own local address, such as `http://192.168.x.x:8787`.

[详细中文使用说明](docs/使用说明.md)
## 中文说明

**DJI RoamDock Pro for Windows** 是完整功能版，运行在 Windows 电脑上，面向 DJI Cellular Dongle 一代，以及兼容的 Baiwang / QDC507 / Quectel USB 4G 模块。新模块、原始 `2CA3:4006` 模块，或需要改 USB 网卡、发短信、完整诊断的用户，用这个项目。电脑插上模块后，Windows 本机浏览器可直接打开；手机、平板或同一 Wi-Fi 下的其他电脑也可以打开电脑自动显示的局域网地址进行管理。

### 最简单的使用方式

1. 安装 [Node.js LTS](https://nodejs.org/)，下载或克隆本仓库。
2. 在项目目录运行一次 `npm install`。
3. 插入模块，双击 `Start-Web-Console.cmd`。
4. 保持这个黑色窗口打开；先在本机浏览器打开 `http://127.0.0.1:8787`，也可以用同一 Wi-Fi 下的手机、平板或其他电脑打开窗口显示的局域网地址。
5. 在网页内点击“自动扫描”，查看 USB、AT 口、SIM、信号、网络和短信状态。

项目只保留一个启动文件：`Start-Web-Console.cmd`。插入模块后双击它，在网页里按需要操作即可。
### 新模块怎么开始

如果设备最初识别为 `2CA3:4006`，仍然使用 `Start-Web-Console.cmd`。先执行只读检查，再按网页提示确认。程序会先保存该模块返回的原始 USB 配置，再进行 VID/PID 与 USB 网卡模式的两阶段设置；已经正常工作的模块不要走这条流程。

### 别的工具改过以后无法识别

先打开网页并点击“异常设备救援”。它会依次检查 Windows USB 设备、设备管理器、COM 口、网卡、可用 AT 口和原始模块接口，并保存本机诊断结果；这个阶段不会修改 VID/PID、`usbnet`、APN 或 eSIM。

只有同时确认硬件属于已验证的 Baiwang / QDC507 类型，并且成功读取该模块当前的 `AT+QCFG="usbcfg"` 和 `AT+QCFG="usbnet"` 返回值后，才应进入恢复写入。找不到 AT 口时，先修复 Windows 驱动绑定或接口占用，不盲写固定参数。已经能正常联网的模块不要执行恢复。

### 使用提醒

- 这是局域网工具，不是公用网站；不要把端口暴露到公网。
- 家里自用 Wi-Fi 一般不需要设置密码；公司、酒店或公共 Wi-Fi 才建议按 [详细中文使用说明](docs/使用说明.md#地址与安全) 设置网页访问密码。
- eSIM 激活码、短信和模块标识属于敏感信息，请不要发到公开 Issue 或截图中。

## Capabilities

- Detect the modem, COM ports, signal, SIM state, registered network, APN, PDP state, and Windows network adapter.
- Present a fast local control page in Chinese or English for Windows browsers, phones, tablets, and other trusted LAN devices.
- List eSIM profiles through `lpac`, enable or disable a profile, set a profile nickname, download a profile with an `LPA:1$...` code, and process pending eSIM notifications.
- Read and refresh SMS, and manually send an SMS after entering the recipient, content, and a confirmation.
- Use one local launcher for diagnostics and management; every operation that writes to the module or eSIM requires an explicit confirmation in the web page.
- Guide a compatible untouched module from `2CA3:4006` to `2C7C:0125`, then set `usbnet=1` so the module provides its own USB Ethernet connection.

## Windows Quick Start

1. Install a current [Node.js LTS release](https://nodejs.org/).
2. Download this repository and open its folder.
3. Run `npm install` once. This installs the USB library needed only for untouched-module detection.
4. Plug in the module and double-click `Start-Web-Console.cmd`.
5. Open `http://127.0.0.1:8787` in any browser on this Windows PC. Optionally open a printed LAN address from a phone, tablet, or another computer on the same Wi-Fi.
6. Press **Auto Scan**.

The black launcher window must remain open while the web console is being used. Windows may ask whether Node.js may use private networks; allow it on a trusted home LAN.

For eSIM functions, run `Install-eSIM-Tools.cmd` once. It downloads the latest official `lpac` Windows release into the local `tools/lpac/` folder. The normal network and modem diagnostics do not require it.

## New / Untouched Module Setup

This is for a compatible module detected as USB `2CA3:4006`, not for a module that already works as `2C7C:0125`.

1. Use the normal `Start-Web-Console.cmd` launcher.
2. In **Original Module Setup**, select **Inspect Original USB**. This only sends read-only `AT` queries and records nothing on the modem.
3. If Windows cannot open the original device, bind its original USB interface to the WinUSB driver and inspect again. Windows does not permit normal serial drivers and raw USB access to own the same interface at once.
4. Select **Convert to Quectel** and type `CONVERT`. The program reads that exact module's `AT+QCFG="usbcfg"` reply, preserves its existing parameter layout, changes only the USB VID/PID to `2C7C:0125`, and restarts the module.
5. Reconnect the module, use **Find AT**, then select **Finish USB Ethernet** and type `USBNET`. This writes `AT+QCFG="usbnet",1` and restarts the modem.
6. Reconnect once more and use **Auto Scan**. The expected state is `2C7C:0125`, an AT COM port, and a Quectel USB Ethernet adapter.

The converter is deliberately two-stage. It will not change a module in the normal launcher, will not use a fixed copied parameter count, and writes a local pre-change baseline to `.local/baselines/` before completing conversion. That directory is ignored by Git.

## eSIM and SMS Launchers / eSIM 与短信入口

| File | What it allows |
| --- | --- |
| `Start-Web-Console.cmd` | One local console for diagnostics, eSIM management, SMS, and the separately confirmed original-module setup flow. |

**中文说明：** 项目只保留一个 `Start-Web-Console.cmd`。双击后网页可以查看模块状态、管理 eSIM、读取和手动发送短信；当检测到兼容原始模块时，也会显示单独确认的原始模块设置流程。每次写入仍需在网页中确认。激活码和短信内容不被应用保存，接口输出会隐藏激活码。

## Security / 安全说明

- Keep the console on a trusted LAN. It can reveal eSIM identifiers and SMS.
- For a shared Wi-Fi, set a token before launch: `$env:CONSOLE_TOKEN = "a-long-random-password"`.
- Do not publish the local port to the internet or put it behind an unauthenticated tunnel.
- Do not use the original-module setup flow on a module which already has a working configuration.
- No eSIM delete action is exposed by the web page.

**中文说明：** 家里自用 Wi-Fi 一般可以直接使用。公司、酒店或公共 Wi-Fi 时，建议先在 PowerShell 运行 `$env:CONSOLE_TOKEN = "你自己的密码"`，再运行 `.\Start-Web-Console.cmd`，并在网页的“Console Token / 控制台密码”输入同一密码。不要把局域网地址暴露到公网或无密码的公网穿透服务。已经能正常使用的模块不要运行原始模块设置；网页没有删除 eSIM Profile 的功能。

## Manual Commands / 手动命令

```powershell
npm install
npm run check
npm start
```

**中文说明：** 这些是安装、检查和开发排错时的手动命令。普通用户直接双击 `Start-Web-Console.cmd` 即可，不必输入这些命令。

## Compatibility Notes / 兼容性说明

The original-module path is designed for the observed Baiwang / QDC507-style `2CA3:4006` device only. It does not claim to support every DJI-branded LTE accessory. Raw USB access on Windows depends on a compatible WinUSB binding; this is a Windows driver ownership requirement, not a modem configuration problem.

**中文说明：** 原始模块设置只针对已观察到的 Baiwang / QDC507 风格 `2CA3:4006` 设备，不代表所有 DJI 标识的 LTE 配件都能使用。Windows 需要兼容的 WinUSB 驱动绑定才能访问原始 USB 接口，这是 Windows 驱动占用规则，不等同于模块硬件损坏。

The eSIM functions use [lpac](https://github.com/estkme-group/lpac). This project is independently implemented and does not include code from DJOneHub or VoHive.

**中文说明：** eSIM 功能调用官方 `lpac` 工具。本项目独立实现，不包含 DJOneHub 或 VoHive 的代码。
## License

MIT. See [LICENSE](LICENSE).
