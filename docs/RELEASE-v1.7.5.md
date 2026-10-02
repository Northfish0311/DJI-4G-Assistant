# Windows v1.7.5 中文更新说明

## 怎么更新

1. 退出旧版 DJI 4G Assistant。
2. 下载 `DJI-4G-Assistant-Setup-1.7.5-x64.exe`，双击安装。
3. 打开桌面上的 DJI 4G Assistant，模块保持原来的连接方式即可。

不需要重新写入 VID/PID、USB 模式、APN 或 eSIM。免安装用户可下载 `DJI-4G-Assistant-Portable-1.7.5-x64.exe`；`Source code` 是开发者源码，不是安装包。

项目没有商业代码签名证书。Edge 或 Windows 首次运行时可能显示安全提醒；请核对本仓库下载地址及 `SHA256SUMS.txt`，详细处理步骤见 README。

## 页面与操作

- 调整电脑版侧栏、概览、字体和颜色，收紧设备状态区。
- 常用操作的四个按钮与标题分隔线留出 16 像素间距。
- 短信搜索框、拨号输入区与标题线留出 12 像素间距；短信双栏标题高度统一，左右分隔线对齐。
- 刷新、新建短信、退格和清空日志使用图标按钮，鼠标悬停显示中英文名称。
- 短信读取成功但没有会话时显示“暂无会话”，不再误写成“尚未读取”。
- 电脑版切换页面后返回，保留之前的滚动位置；定时读取不清除当前短信草稿。

## 稳定性

- 网络刷新失败或返回异常数据时，保留上次有效网卡与流量数据，并显示“刷新失败”。这些值是上次采样，不代表当前速度。
- 网络失败后逐步延长重试间隔，最长 30 秒；隐藏页面、确认操作期间暂停后台流量读取。手动刷新不受自动重试等待限制。
- 修复 Windows ADB USB 写入回调被错误当作数据缓冲区的问题。
- 按模块协议分开发送 ADB 头部与数据，兼容实际 USB 读取超时返回值，避免查询卡住。

## 验证与边界

已运行 JavaScript 测试、语法检查，以及 1920、1440、1024、880、390 像素宽度的浏览器布局测试，检查间距、短信分隔线、草稿保留与页面溢出。界面测试使用虚构数据，不包含个人短信或卡号。

ADB 修复已在连接 Windows 的 QDC507 上完成只读 shell 查询验证；本次没有额外修改模块配置或安装模块端程序。声音驱动加载与双向通话没有在本次更新中重新完成端到端验证，不宣称修复了所有通话声音问题。

这次只发布 Windows 更新。Mac 版不开发；iOS 暂停新增开发和发布。Windows 同一局域网的浏览器访问保持可用。

## 参考

借鉴公开项目的界面组织和异步更新思路，本次界面与交互代码独立实现，没有复制其源码：

- [CellDock 短信窗口](https://github.com/celldock/celldock-for-mac/blob/main/Sources/CellDock/MessagesWindowView.swift)：会话列表与正文分栏、保留当前选择。
- [MaVo 菜单界面](https://github.com/moluncn/mavo/blob/main/Sources/MaVo/MenuContentView.swift)：设备状态、日常操作和临时反馈分层。
- [NetXD 流量监测](https://github.com/Trouwlikesnow/NetXD/blob/main/Sources/NetXD/NetworkSpeedMonitor.swift)：后台采样、按时间差计算速度、独立更新界面。
