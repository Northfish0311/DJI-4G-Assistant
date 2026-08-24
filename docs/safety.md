# 硬件安全 / Hardware Safety

状态扫描、网络读取、短信读取和救援诊断是只读操作。以下操作会改变设备状态并要求确认：eSIM 启用、停用、下载、改名或删除，短信删除或发送、USSD、`usbnet` 切换、VID/PID 修改、QDC507 ADB/UAC 启用和模块重启。

写入 eSIM 时不要拔卡、拔模块或关闭程序。删除 Profile 和短信可能无法恢复，激活码也可能不能再次下载。

## QDC507 通话声音

- 自动扫描不会写声音配置。只有精确匹配 `QDC507 / QDC507GLEFM21`、可读取 15 位 IMEI、USB 身份属于已验证范围且返回七位 `usbcfg` 时，才开放持久设置。
- 写入前保存本地备份；目标值保留 VID/PID 和前五个 USB 功能，只把 ADB、UAC 两位设为 1。写入后必须精确读回才请求重启。
- QADBKEY 的挑战和派生响应不会进入日志或备份。授权可能持久存在，恢复 USB 位不能保证撤销授权。
- “恢复最近 USB 备份”只接受同一 IMEI 和 VID/PID 的本地备份，并在恢复前再保存保护性备份。
- Zadig 只能给 `QDC507 ADB MI_06` 或已检测的 `ff/42/01` ADB 子接口绑定 WinUSB。不要替换复合设备本体、ECM、AT、NMEA、Modem 或音频驱动。
- 语音内核模块从固定 MaVo commit 按需下载，逐个校验大小和 SHA-256，只临时加载到内存，不写 boot、MTD、DIAG 或 EDL。模块重启后清除。
- 挂断或停止声音时，程序只终止自己创建且 PID 与启动时间均匹配的 helper，并关闭自有 UAC 路由，不强制卸载内核模块。

安装 Windows ECM 驱动会更改系统驱动并需要管理员权限。该流程仅允许精确匹配 `USB\VID_2C7C&PID_0125&MI_04`，下载 Quectel 官方包后核对固定 SHA256、硬件 ID、版本和数字签名，并在安装前导出当前 Quectel 驱动。任何检查失败都会停止。它不会修改模块 AT、APN、eSIM 或 USB 模式，但安装期间网卡会短暂断开。

仅在程序验证为兼容的原始 `2CA3:4006` 设备上初始化。程序应先记录 `ATI`、`AT+GMR`、`usbnet`、`usbcfg`、SIM、注册和信号。已正常工作的模块不要重复初始化；未知 VID/PID、未知固件或无法读取 AT 基线时应停止。

桌面版每次启动生成临时密码。只在可信局域网使用，不要将端口暴露到公网或无认证隧道。

The app performs real modem and eUICC writes only after explicit confirmation. QDC507 voice setup preserves existing USB functions, keeps a local backup, pins and verifies its on-demand runtime, and never writes boot, MTD, DIAG, or EDL. Never bind WinUSB to the composite parent or a non-ADB child interface.
