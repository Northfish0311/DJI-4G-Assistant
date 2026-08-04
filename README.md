# DJI Cellular Dongle Windows Hub

A native Windows control hub for the first-generation DJI Cellular Dongle and compatible Baiwang / QDC507 / Quectel USB LTE modules. It runs on the Windows PC and provides a bilingual Chinese/English control page for an iPad, phone, or browser on the same LAN.

It is a local tool, not a shared website. Every computer starts its own local address, such as `http://192.168.x.x:8787`.

## Capabilities

- Detect the modem, COM ports, signal, SIM state, registered network, APN, PDP state, and Windows network adapter.
- Present a fast iPad-friendly local control page in Chinese or English.
- List eSIM profiles through `lpac`, enable or disable a profile, set a profile nickname, download a profile with an `LPA:1$...` code, and process pending eSIM notifications.
- Read SMS, optionally refresh the inbox, and send an SMS only from a dedicated launcher.
- Keep the normal launcher read-only.
- Guide a compatible untouched module from `2CA3:4006` to `2C7C:0125`, then set `usbnet=1` so the module provides its own USB Ethernet connection.

## Windows Quick Start

1. Install a current Node.js LTS release.
2. Download this repository and open its folder.
3. Run `npm install` once. This installs the USB library needed only for untouched-module detection.
4. Plug in the module and double-click `Start-iPad-Console.cmd`.
5. Open the printed LAN address from iPad Safari or any device on the same Wi-Fi.
6. Press **Auto Scan**.

The black launcher window must remain open while the iPad page is being used. Windows may ask whether Node.js may use private networks; allow it on a trusted home LAN.

For eSIM functions, run `Install-eSIM-Tools.cmd` once. It downloads the latest official `lpac` Windows release into the local `tools/lpac/` folder. The normal network and modem diagnostics do not require it.

## New / Untouched Module Setup

This is for a compatible module detected as USB `2CA3:4006`, not for a module that already works as `2C7C:0125`.

1. Use `Start-iPad-Console-Original-Module-Setup.cmd` instead of the normal launcher.
2. In **Original Module Setup**, select **Inspect Original USB**. This only sends read-only `AT` queries and records nothing on the modem.
3. If Windows cannot open the original device, bind its original USB interface to the WinUSB driver and inspect again. Windows does not permit normal serial drivers and raw USB access to own the same interface at once.
4. Select **Convert to Quectel** and type `CONVERT`. The program reads that exact module's `AT+QCFG="usbcfg"` reply, preserves its existing parameter layout, changes only the USB VID/PID to `2C7C:0125`, and restarts the module.
5. Reconnect the module, use **Find AT**, then select **Finish USB Ethernet** and type `USBNET`. This writes `AT+QCFG="usbnet",1` and restarts the modem.
6. Reconnect once more and use **Auto Scan**. The expected state is `2C7C:0125`, an AT COM port, and a Quectel USB Ethernet adapter.

The converter is deliberately two-stage. It will not change a module in the normal launcher, will not use a fixed copied parameter count, and writes a local pre-change baseline to `.local/baselines/` before completing conversion. That directory is ignored by Git.

## eSIM and SMS Launchers

| File | What it allows |
| --- | --- |
| `Start-iPad-Console.cmd` | Read-only diagnostics, profile list, SMS inbox, and safe AT queries. |
| `Start-iPad-Console-Profile-Controls.cmd` | Enable or disable an existing eSIM profile. |
| `Start-iPad-Console-eSIM-Download.cmd` | Download a new profile with an activation code you own. |
| `Start-iPad-Console-eSIM-Management.cmd` | Profile actions, download, nickname, and notification processing. |
| `Start-iPad-Console-SMS-Send.cmd` | Send SMS. Carrier charges may apply. |
| `Start-iPad-Console-Original-Module-Setup.cmd` | The two explicit writes used only for an untouched compatible module. |

Each write action is additionally confirmed in the browser. Activation codes and SMS text are not stored by the app; activation codes are redacted from API output.

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
