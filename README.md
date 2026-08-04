# DJI RoamDock for Windows

A native Windows control hub for the first-generation DJI Cellular Dongle and compatible Baiwang / QDC507 / Quectel USB LTE modules. It runs on the Windows PC and provides a bilingual Chinese/English web console. Use it directly in a browser on the Windows PC, or optionally from a phone, tablet, or another computer on the same LAN.

It is a local tool, not a shared website. Every computer starts its own local address, such as `http://192.168.x.x:8787`.
## 中文说明

**DJI RoamDock for Windows** 是一个运行在 Windows 电脑上的本地管理页，面向 DJI Cellular Dongle 一代，以及兼容的 Baiwang / QDC507 / Quectel USB 4G 模块。电脑插上模块后，Windows 本机浏览器可直接打开；手机、平板或同一 Wi-Fi 下的其他电脑也可以打开电脑自动显示的局域网地址进行管理。

### 最简单的使用方式

1. 安装 Node.js LTS，下载或克隆本仓库。
2. 在项目目录运行一次 `npm install`。
3. 插入模块，双击 `Start-Web-Console.cmd`。
4. 保持这个黑色窗口打开；先在本机浏览器打开 `http://127.0.0.1:8787`，也可以用同一 Wi-Fi 下的手机、平板或其他电脑打开窗口显示的局域网地址。
5. 在网页内点击“自动扫描”，查看 USB、AT 口、SIM、信号、网络和短信状态。

现在只需要双击一个 `Start-Web-Console.cmd`。网页会显示模块状态、eSIM 管理、短信发送和原始模块设置；所有会写入卡片或模块的操作仍必须在网页中输入确认词。
### 启动文件说明

只保留 `Start-Web-Console.cmd`。双击后在网页里完成查看状态、eSIM Profile 启用/停用、下载自己购买的 `LPA:1$...` 套餐、处理 eSIM 通知、手动发送短信，以及兼容原始模块的 USB 网卡设置。短信必须手动填写号码和内容，运营商可能收费；eSIM 下载、切换和原始模块设置均有额外确认；不提供删除 Profile。
### 新模块怎么开始

如果设备最初识别为 `2CA3:4006`，仍然使用 `Start-Web-Console.cmd`。先执行只读检查，再按网页提示确认。程序会先保存该模块返回的原始 USB 配置，再进行 VID/PID 与 USB 网卡模式的两阶段设置；已经正常工作的模块不要走这条流程。

### 使用提醒

- 这是局域网工具，不是公用网站；不要把端口暴露到公网。
- 共享 Wi-Fi 下请设置 `CONSOLE_TOKEN`。
- eSIM 激活码、短信和模块标识属于敏感信息，请不要发到公开 Issue 或截图中。

## Capabilities

- Detect the modem, COM ports, signal, SIM state, registered network, APN, PDP state, and Windows network adapter.
- Present a fast local control page in Chinese or English for Windows browsers, phones, tablets, and other trusted LAN devices.
- List eSIM profiles through `lpac`, enable or disable a profile, set a profile nickname, download a profile with an `LPA:1$...` code, and process pending eSIM notifications.
- Read SMS, optionally refresh the inbox, and send an SMS only from a dedicated launcher.
- Keep the normal launcher read-only.
- Guide a compatible untouched module from `2CA3:4006` to `2C7C:0125`, then set `usbnet=1` so the module provides its own USB Ethernet connection.

## Windows Quick Start

1. Install a current Node.js LTS release.
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

## eSIM and SMS Launchers

| File | What it allows |
| --- | --- |
| `Start-Web-Console.cmd` | One local console for diagnostics, eSIM management, SMS, and the separately confirmed original-module setup flow. |`r`nEach write action is additionally confirmed in the browser. Activation codes and SMS text are not stored by the app; activation codes are redacted from API output.

## Security

- Keep the console on a trusted LAN. It can reveal eSIM identifiers and SMS.
- For a shared Wi-Fi, set a token before launch: `$env:CONSOLE_TOKEN = "a-long-random-password"`.
- Do not publish the local port to the internet or put it behind an unauthenticated tunnel.
- Do not use the original-module setup flow on a module which already has a working configuration.
- No eSIM delete action is exposed by the web page.

## Manual Commands

```powershell
npm install
npm run check
npm start
```

## Compatibility Notes

The original-module path is designed for the observed Baiwang / QDC507-style `2CA3:4006` device only. It does not claim to support every DJI-branded LTE accessory. Raw USB access on Windows depends on a compatible WinUSB binding; this is a Windows driver ownership requirement, not a modem configuration problem.

The eSIM functions use [lpac](https://github.com/estkme-group/lpac). This project is independently implemented and does not include code from DJOneHub or VoHive.

## License

MIT. See [LICENSE](LICENSE).
