$ErrorActionPreference = 'Stop'
Write-Host '大疆 4G 助手：Windows 网卡优先级'
Write-Host '1. 优先使用 Wi-Fi（Wi-Fi 断开时仍可回落到 4G）'
Write-Host '2. 恢复大疆网卡原先的优先级'
Write-Host '3. 退出，不修改设置'
$answer = Read-Host '请选择 1 / 2 / 3'
if ($answer -notin @('1','2')) { exit 0 }
$action = if ($answer -eq '1') { 'Prefer' } else { 'Restore' }
& (Join-Path $PSHOME 'powershell.exe') -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'wifi-preference.ps1') -Mode $action
$code = $LASTEXITCODE
$messages = @{
  0='已核对设置。实际默认出口请看助手的网络页。'; 10='未发现支持的大疆 ECM 网卡，请先插入模块。没有更改设置。';
  11='请只保留要设置的那一个模块。'; 12='请先连接有 IPv4 默认路由的 Wi-Fi。'; 13='此网卡没有可恢复的备份。';
  14='网卡在检查期间发生变化，请重新连接。'; 15='已取消管理员授权。'; 16='检测到手动改动或优先级变化，已停止，未强制覆盖。';
  17='设置失败，本次修改已回退。'; 18='未能完全回退，备份仍在。请接回同一网卡后选择恢复。';
  19='另一个网络设置操作正在进行。'; 20='此网卡配置暂不支持。'
}
if ($messages.ContainsKey($code)) { Write-Host $messages[$code] } else { Write-Host '未能确认结果，请检查连接、管理员权限和当前优先级。' }
$null = Read-Host '按回车键关闭'
exit $code
