# Security / 安全说明

DJI 4G Assistant 可能读取 IMSI、ICCID、EID、短信、APN、运营商状态和本机网络地址。

- 只从本仓库 Releases 下载 EXE，并核对 SHA256。
- 仅在可信局域网使用。桌面版为当前 Windows 用户持久保存随机控制密码，源码启动器每次运行生成临时密码。
- iPhone/iPad 配对二维码包含局域网地址和控制密码，等同于管理钥匙；不要截图公开。iOS App 将密码保存在 Apple Keychain。
- Windows 的 Bonjour 广播不包含控制密码，配对 API 仍要求已有认证。
- 不要把端口发布到公网或无认证隧道。
- 未签名 IPA 只能使用自己的 Apple ID 或开发者证书签名。不要把 Apple ID、密码、证书或私钥提交到仓库、Issue 或聊天。
- 不要在公开 Issue、截图或聊天中泄露激活码、EID、ICCID、IMSI、IMEI 和短信。
- EID 本地备注、已验证私有 AID 和 USB 备份保存在 `.local` 或应用数据目录，不要上传。
- eSIM、短信删除和模块写入即使经过确认也可能不可恢复。
- Windows ECM 驱动修复需要管理员权限，只对精确匹配接口开放，并在下载校验、签名验证和旧驱动备份后执行。
- 危险 AT 默认受限；开发者只有保存基线后才应设置 `ALLOW_DANGEROUS_AT=1`。
- 拨号、接听、挂断会直接控制模块，可能产生运营商费用。
- QDC507 声音设置只对精确固件开放。写入前备份并读回，QADBKEY 挑战和响应会脱敏；授权可能持久存在。
- Zadig 只能绑定 `QDC507 ADB MI_06` 子接口。替换复合设备、ECM、AT、NMEA、Modem 或音频驱动可能让设备失联。
- 可选语音运行时按需从固定 MaVo commit 下载并核对 SHA-256，不包含在 EXE 中；内核模块临时加载，模块重启后清除。
- 声音桥只在 Windows 本机检测到匹配 USB 音频端点后开放，启动时才请求麦克风，挂断后自动停止。

报告漏洞时请删除全部真实 SIM/eSIM 标识、IMEI、激活码和短信正文。

## English

Use the console only on a trusted LAN. Never expose its port publicly. Treat activation codes, ICCIDs, IMSIs, EIDs, IMEIs, SMS, and local USB backups as secrets. Destructive profile and modem actions can be irreversible. Bind WinUSB only to the verified QDC507 ADB child interface.
