# Security / 安全说明

DJI RoamDock 可能读取 IMSI、ICCID、短信、APN、运营商状态和本机网络地址。

- 只从本仓库 Releases 下载 EXE，并核对 SHA256。
- 仅在可信局域网使用；桌面版每次启动自动生成临时密码。
- 不要把端口发布到公网或无认证隧道。
- 不要在公开 Issue、截图或聊天中泄露激活码、ICCID、IMSI 和短信。
- eSIM 删除和模块写入即使经过确认也可能不可恢复。
- 危险 AT 默认受限；开发者只有保存基线后才应设置 `ALLOW_DANGEROUS_AT=1`。

报告漏洞时请删除全部真实 SIM/eSIM 标识和激活码。

## English

Use the console only on a trusted LAN. Never expose its port publicly. Treat activation codes, ICCIDs, IMSIs, and SMS as secrets. Destructive profile and modem actions can be irreversible.
