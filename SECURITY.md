# Security / 安全说明

DJI 4G Assistant 可能读取 IMSI、ICCID、短信、APN、运营商状态和本机网络地址。

- 只从本仓库 Releases 下载 EXE，并核对 SHA256。
- 仅在可信局域网使用；桌面版和 `Start-Web-Console.cmd` 每次启动都会自动生成临时密码。
- 不要把端口发布到公网或无认证隧道。
- 不要在公开 Issue、截图或聊天中泄露激活码、EID、ICCID、IMSI 和短信。
- EID 本地备注和已验证私有 AID 保存在 `.local`，不要把该目录复制到公开仓库或发给他人。
- eSIM 删除和模块写入即使经过确认也可能不可恢复。
- Windows ECM 驱动修复需要管理员权限，只对精确匹配接口开放，并在下载校验、签名验证和旧驱动备份后执行。
- 危险 AT 默认受限；开发者只有保存基线后才应设置 `ALLOW_DANGEROUS_AT=1`。
- 拨号、接听、挂断会直接控制模块，可能产生运营商费用；号码输入错误时请立即挂断。
- 声音桥只在 Windows 本机检测到匹配的 USB 音频端点后开放，启动时才请求麦克风，挂断后自动停止。

报告漏洞时请删除全部真实 SIM/eSIM 标识和激活码。

## English

Use the console only on a trusted LAN. Never expose its port publicly. Treat activation codes, ICCIDs, IMSIs, and SMS as secrets. Destructive profile and modem actions can be irreversible.
