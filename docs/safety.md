# 硬件安全 / Hardware Safety

状态扫描、网络读取和救援诊断是只读操作。以下操作会改变设备状态并要求确认：eSIM 启用、停用、下载、改名或删除，短信、USSD、`usbnet` 切换、VID/PID 修改和模块重启。

写入 eSIM 时不要拔卡、拔模块或关闭程序。删除 Profile 可能无法恢复，激活码也可能不能再次下载。

安装 Windows ECM 驱动会更改系统驱动并需要管理员权限。该流程仅允许精确匹配 `USB\VID_2C7C&PID_0125&MI_04`，下载 Quectel 官方包后核对固定 SHA256、硬件 ID、版本和数字签名，并在安装前导出当前 Quectel 驱动。任何检查失败都会停止。它不会修改模块 AT、APN、eSIM 或 USB 模式，但安装期间网卡会短暂断开。

仅在程序验证为兼容的原始 `2CA3:4006` 设备上初始化。程序应先记录 `ATI`、`AT+GMR`、`usbnet`、`usbcfg`、SIM、注册和信号。已正常工作的模块不要重复初始化；未知 VID/PID、未知固件或无法读取 AT 基线时应停止。

桌面版每次启动生成临时密码。只在可信局域网使用，不要将端口暴露到公网或无认证隧道。

The app performs real modem and eUICC writes only after explicit confirmation. Never initialize an already working or unverified device.
