# TestFlight 安装与发布

## 当前状态

本项目选择 TestFlight 作为后续 iPhone/iPad App 的主要测试分发方式。**目前还没有有效的 TestFlight 邀请链接，也没有完成 Apple 签名上传。** GitHub 的未签名 IPA 和绿色构建记录不表示已经在 TestFlight 上架。

## 普通用户以后怎么安装

1. 从 App Store 安装 Apple 官方 TestFlight。
2. 打开本项目正式公布的邀请链接，接受邀请并点击安装。
3. 模块插在 Windows 电脑上，保持电脑助手运行；手机与电脑在同一可信局域网。
4. 打开 App，扫描电脑助手的配对码。

这些步骤在邀请链接开放后才适用。无需测试者自己签名或注册付费开发者账号。当前 App 最低系统要求为 iOS/iPadOS 16，实际可安装范围也受 TestFlight 当时的要求影响，并不是所有历史型号都支持。测试包有有效期，不是永久正式版。

## 发布者首次需要准备

- 有效的 Apple Developer Program 会员，以及对应 App Store Connect 权限。普通 Apple ID 不等同于已开通会员。
- 在开发团队中登记 Bundle ID `com.northfish0311.dji4gassistant`，并建立对应的 iOS App 记录。若该 ID 无法在团队内登记，需要统一修改工程和相关配置，不能只改上传参数。
- 选择合法有效的签名方式：分发证书及其私钥、匹配的 App Store 分发描述文件，或正确配置的 Apple 云端签名。
- 为自动上传配置权限足够的 App Store Connect API Key。API Key 不等于分发证书，不能单凭一份 API Key 把现有未签名 IPA 变成可发布版本。
- 准备支持联系方式、隐私说明、测试说明和真实可行的审核方式。应用依赖 Windows 与模块，审核说明必须说清楚；不能提供审核人员无法访问的个人局域网地址作为可用演示服务。

只有 Windows 也可以使用托管 macOS 构建机。代码编译可在云端完成，但会员、协议接受、签名权限和 Apple 审核不会因此免除。不要为了这一步直接购买 Mac，先确认账号条件。

## 凭据怎么保存

不把 Apple 密码、API 私钥、P12、描述文件或签名密码发到聊天、README、Git 仓库、Release 或构建日志。若使用 GitHub Actions，将它们存入受保护的发布 Environment 的 Secrets，并要求人工批准发布；只有受信任主分支的手动工作流可以访问，不能开放给外部 PR。

现有 `Build iOS companion` 仍用于未签名构建与测试，不会自动上传到 Apple。新的 `Upload iOS remote app to TestFlight` 是手动工作流，尚未配置和实测 Apple 签名上传；缺少必需配置时会失败，不会假装发布成功。

### 配置清单（发布者使用）

在 GitHub 仓库 Settings → Environments 中创建 `testflight`，限制只允许 `main` 分支，配置人工审批（仓库方案支持时）。添加变量 `XCODE_PATH`，值为托管 macOS 构建机上实际存在且满足 Apple 当前上传要求的 Xcode.app 完整路径，不要照抄本机路径。工作流会打印 Xcode 和 SDK 版本，是否满足当时的上传政策仍需核对。

在该 Environment 的 Secrets 中添加：

| 名称 | 内容 |
| --- | --- |
| `APPLE_TEAM_ID` | Apple 开发团队 ID |
| `APPLE_CERTIFICATE_P12_BASE64` | 包含私钥的 Apple Distribution P12 文件的 Base64 |
| `APPLE_CERTIFICATE_PASSWORD` | 该 P12 的导出密码；未设置密码时可为空 |
| `APPLE_PROFILE_BASE64` | 匹配团队和 Bundle ID 的 App Store 分发描述文件的 Base64 |
| `ASC_KEY_ID` | App Store Connect API Key ID |
| `ASC_ISSUER_ID` | API Key 的 Issuer ID |
| `ASC_PRIVATE_KEY_BASE64` | 对应 P8 私钥文件的 Base64 |

Base64 只是编码，不是加密，也属于秘密。不要把编码结果提交到仓库。

配置完成后，打开 Actions → Upload iOS remote app to TestFlight → Run workflow，选择 main，填写未使用过的构建号（1 至 9999），再运行。它先执行模拟器测试，再校验描述文件、签名归档并上传，最后清理临时密钥链和文件。不自动对外开放邀请，也不修改 Windows 发布。

本地可执行 `node --test test/testflight.test.js` 验证配置校验逻辑。这不等于 Apple 证书有效或真机上传测试通过。实际签名、SDK 合规及 Apple 处理结果必须在账号配置后验证。

## 完整发布顺序

1. 确认开发者会员、App 记录、签名和上传权限齐全。
2. 使用符合 Apple 当前要求的 Xcode/iOS SDK，运行测试并创建签名 Archive；不能把旧 SDK 的成功构建当成当前商店上传合规证明。
3. 给每次上传分配新的构建号，导出并上传 App Store Connect，等待 Apple 处理。不得覆盖同一版本下已上传的构建号。
4. 按实际情况完成出口合规和隐私信息，不为省步骤填写虚假声明。
5. 先邀请内部测试者，验证真实扫码、局域网权限、连接恢复和模块操作。
6. 创建外部测试组，填写 Beta App Review 联系方式及测试说明，提交所需审核。
7. 审核允许外部测试后，开放邀请链接，再更新 README。上传成功、处理成功和审核通过是三个不同状态。

Windows 安装包继续在 GitHub Releases 提供，不被 iOS 测试版本替换。

## 官方入口

- [Apple Developer Program](https://developer.apple.com/programs/)
- [App Store Connect](https://appstoreconnect.apple.com/)
- [上传构建说明](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)
- [邀请外部测试者](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers)
