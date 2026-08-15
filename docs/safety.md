# 硬件安全 / Hardware Safety

状态扫描、网络读取和救援诊断是只读操作。以下操作会改变设备状态并要求确认：eSIM 启用、停用、下载、改名或删除，短信、USSD、`usbnet` 切换、VID/PID 修改和模块重启。

写入 eSIM 时不要拔卡、拔模块或关闭程序。删除 Profile 可能无法恢复，激活码也可能不能再次下载。

仅在程序验证为兼容的原始 `2CA3:4006` 设备上初始化。程序应先记录 `ATI`、`AT+GMR`、`usbnet`、`usbcfg`、SIM、注册和信号。已正常工作的模块不要重复初始化；未知 VID/PID、未知固件或无法读取 AT 基线时应停止。

桌面版每次启动生成临时密码。只在可信局域网使用，不要将端口暴露到公网或无认证隧道。

The app performs real modem and eUICC writes only after explicit confirmation. Never initialize an already working or unverified device.
