# 大疆 4G 助手 1.9.2 · Windows 64 位

**只想收短信，不想让电脑消耗卡流量？** 这个版本在桌面助手的“网络”页新增了 **禁止大疆流量** 和 **允许大疆流量**。

1. 退出旧版。[下载安装版（推荐）](https://github.com/Northfish0311/DJI-4G-Assistant/releases/download/v1.9.2/DJI-4G-Assistant-Setup-1.9.2-x64.exe) 并双击安装；或选[免安装版](https://github.com/Northfish0311/DJI-4G-Assistant/releases/download/v1.9.2/DJI-4G-Assistant-Portable-1.9.2-x64.exe)，双击直接打开。不用两个都下，也不用安装 Node.js。
2. 先让电脑连上 Wi-Fi，再插入模块。打开助手的 **网络 → 禁止大疆流量**，按提示确认，等页面显示已停用。之后即使 Wi-Fi 掉线，电脑也不会通过这张 USB 网卡上网。
3. 想重新用卡上网？接回同一个模块，点 **允许大疆流量**。如果只是想让 Wi-Fi 优先、断线时保留 4G 备用，选 **优先使用 Wi-Fi**，不要点“禁止”。

**停用的是网卡，不是 SIM 卡。** 模块自带的 USB 网页会暂时打不开，但助手不会修改独立短信串口、SIM 或 APN。收短信仍需可用的 AT 串口、已注册的网络及支持短信的套餐。

只处理唯一匹配的 Quectel ECM 网卡。换 USB 插口或换模块后请重新核对。这个开关不限制其他网卡或 VPN，也不能据此判断聊天软件“等待网络”的原因。
