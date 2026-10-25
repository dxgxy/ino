# Android migration

Open `D:\ino_Android\android-app` in Android Studio (the shortcut target is `D:\Android\AndroidStudio\bin\studio64.exe`). The project is a native Android WebView shell around the shared React/Vite UI.

- `android-app/app/src/main/java/.../MainActivity.java` hosts the offline web UI and Android TextToSpeech bridge.
- Gradle task `buildWeb` runs the shared `npm run build`; `syncWebAssets` copies `dist` into Android assets before `preBuild`.
- Set `-PwordflowApiUrl=https://your-domain.example` for a deployed account API. The default emulator URL is `http://10.0.2.2:8787`.
- Android account requests use a memory-only bearer token and the `X-Wordflow-Client: android` API mode; learning data remains local.

Command line (when Gradle is available):

```bat
cd /d D:\ino_Android
npm install
cd android-app
.\gradlew.bat assembleDebug -PwordflowApiUrl=http://10.0.2.2:8787
```

The debug APK is written to `android-app/app/build/outputs/apk/debug/app-debug.apk`.

## 发音链路

Android 端优先使用词典返回的音频地址；音频不可用时调用原生 `TextToSpeech`；原生 TTS 未安装英语语音包时再退回 Web Speech API。原生桥接不会接收账号令牌。

## 账号检查

Android WebView 使用 `https://appassets.androidplatform.net` 作为本地页面来源，账号请求带 `X-Wordflow-Client: android`，会话令牌只保存在当前页面内存。服务端测试覆盖预检、注册、bearer 会话和 SQLite 用户/密码哈希持久化。

## Android 首页仪表盘

Android 启动页现在提供：左上角头像、昵称和本机学习等级；离线双语词典/功能模块搜索；List 复习情况；今日简报；基于每个 List 到期卡片的艾宾浩斯规划；底部首页、List、设置和扩展导航。首页不显示桌面端左侧 List 栏，避免遮挡主要内容。

搜索支持词面、中文释义、英文解释和功能模块关键词。点击词典结果打开完整离线词卡并可播放发音；点击功能结果跳转对应页面。扩展页只提供注册入口，未来模块应通过 `androidExtensions` 注册，不直接耦合首页。
