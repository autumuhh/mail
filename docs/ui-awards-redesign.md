# Maildrop 编辑式界面改版与自检记录

## 1. 交付状态与边界

> 本报告记录界面验收节点（北京时间 2026-10-08 01:27:50）的状态；后续 Git 提交、作者 PR 和生产部署属于用户另行授权的发布任务，发布身份以对应记录为准。

- **状态：本地实现与连续两轮复核完成，用户已验收，本次任务结束；未部署、未提交 Git。**
- 基于提交 `fd5dae62e02d40ff0fc84856c6c418732cbe6e05` 的工作区改版，不冒充新的已发布版本。
- Awwwards、Webby Awards、FWA 是用户指定的品质参照，不是实际获奖或评分背书。结论仅限本次检查范围，不承诺所有设备上的绝对完美。
- 保留 Python Flask + 原生 HTML/CSS/JS，不增加前端构建、第三方字体、动画框架或远程素材。
- 只修改前端、相关契约测试、开发验证脚本/依赖和报告忽略规则；不修改后端、数据库结构、API、SMTP、生产配置或真实数据。

## 2. 页面范围与设计系统

| 页面族 | 本次改版覆盖 |
| --- | --- |
| 公开访问 | `/`、`/web`：品牌、编辑式首屏、邮箱/密钥输入、完整链接访问、校验反馈与主题切换 |
| 收件工作台 | `/web/<邮箱>----<密钥>`：鉴权、列表、搜索、选择、已读、删除、阅读详情、邮箱信息及快速切换 |
| 邮箱创建 | `/register`：管理员门禁、表单、域名选择、期限、白名单、说明弹窗及真实创建结果 |
| 只读 API | `/api-test`：鉴权、只读请求、JSON 输出、安全说明与会话清空 |
| 后台管理 | `/admin`：门禁，以及仪表板、邮箱、审计、安全、创建、子管理员、设置七个视图及原有弹窗/创建模式 |

**视觉方向：**暖白纸面、深绿文字、薄荷色强调，平面边界与编辑式留白；以“收件，简单一点”为核心叙事。

| 令牌 | 浅色 | 深色 |
| --- | --- | --- |
| 页面底色 | `#F7F7F2` | `#111916` |
| 内容表面 | `#FFFFFF` | `#19231F` |
| 正文 | `#172824` | `#EDF3ED` |
| 次级文字 | `#5D6B66` | `#B0BDB4` |
| 主色 | `#236552` | `#B9E8C8` |
| 主按钮文字 | `#FFFFFF` | `#122218` |
| 强输入边界 | `#7C9085` | `#879A8B` |

- 基础正文/输入 16px；中文采用系统无衬线，地址、时间、JSON 采用系统等宽字体，不依赖字体下载。
- 4/8 间距网格，8/12/20px 圆角；去除浮雕、重复阴影和非必要渐变，浮层才使用必要阴影。
- 首帧恢复 auto/light/dark；auto 分别验证系统浅色和深色。偏好仍仅保存在当前会话。
- 收件工作区保持最大 1240px、桌面侧栏 220px、地址区域几何居中，不因两侧按钮数量变化而偏移。
- 原创折叠信封 M 标记、favicon 和本地投递场景 SVG；未复制获奖站点版式或使用其标识。

实现入口：
- 设计令牌：`F:/maildrop-master/src/frontend/static/styles/ui_foundation.css:1`；占位颜色与标题断行：`F:/maildrop-master/src/frontend/static/styles/ui_foundation.css:150`、`F:/maildrop-master/src/frontend/static/styles/ui_foundation.css:180`。
- 登录排版与移动首屏：`F:/maildrop-master/src/frontend/static/styles/mailbox_login.css:1`。
- 收件几何布局：`F:/maildrop-master/src/frontend/static/styles/mailbox_manager.css:11`；阅读操作不拆字：`F:/maildrop-master/src/frontend/static/styles/mailbox_manager.css:85`。
- 原创场景：`F:/maildrop-master/src/frontend/static/resources/delivery-scene.svg:1`。
- 公共弹窗与请求反馈：`F:/maildrop-master/src/frontend/static/scripts/ui_components.js:233`。

## 3. 八个维度：发现 → 修正 → 复核

| 维度 | 发现与修正 | 复核方法 |
| --- | --- | --- |
| 排版 | 统一字号和标题层级；修正后台 h1→h3 跳级、手机阅读按钮孤字换行；大标题平衡断行，200% 文字也不丢失内容 | 桌面/手机浅深色截图、320px 阅读专测、200% 文字截图、标题/名称规则扫描 |
| 留白 | 去除“卡片套卡片”与内凹阴影；用边界和间距区分内容；手机统计改为紧凑双列，缩短登录首屏 | 13 个界面同屏总览与原尺寸局部图，核对节奏、边缘和按钮间距 |
| 视觉层级 | 主操作稳定突出，危险操作不抢主线；API 改为三步结构；后台保留品牌与原生导航；取消虚构版本/运行时间 | 首屏路径、真实数据/空状态、表单/表格/弹窗逐图检查 |
| 色彩 | 统一深绿/薄荷，不再混用紫色渐变与突兀亮绿；深色按钮使用深色文字；提高输入边界对比，纠正暗色原生占位文字偏暗 | 两主题对比度计算、axe 自动判定及人工复核项 |
| 动效 | 微反馈 180ms，状态/新增行至多 320ms，登录叙事一次性 480ms；不整屏重播列表入场 | reduced-motion 下无活动动画；仅真实新增 ID 入场；真实待处理请求才出现旋转/忙碌 |
| 微交互 | 保持搜索、选择、滚动和焦点；删除后回到相邻行；Tab 循环/Escape/返回焦点；显式记录按钮，修复 WebKit 鼠标点击焦点差异；忙碌按钮尺寸不跳变 | 三内核真实交互、延迟请求、单条/批量删除、全部已读、弹窗键盘与焦点断言 |
| 响应式 | 主操作留在 390×844 登录首屏；输入字号不缩小；主要命中区域至少 44px；长地址/主题可阅读；表格仅在自身区域横向滚动并提供提示 | 七种宽度、全页溢出/命中区域/输入字号扫描、320px 阅读专测与文字放大 |
| 原创性 | 从收件场景推导折叠信封 M、邮戳与纸面叙事；用工具型信息布局而非堆砌宣传数字；仅使用本地原创矢量图与系统字体 | 图标/资源 XML 检查、外部请求拦截、真实页面品牌/素材一致性复核 |

另修正辅助名称与可见文字不一致、无角色 div 的多余命名、鉴权/阅读视图切换后的隐藏跳转目标、条款按钮嵌入 checkbox label 等问题。

源代码回归入口：
- 行刷新/选择/焦点：`F:/maildrop-master/src/frontend/static/scripts/mailbox_manager.js:331`。
- 可见跳转目标：`F:/maildrop-master/src/frontend/static/scripts/mailbox_manager.js:158`。
- 后台点击发起元素：`F:/maildrop-master/src/frontend/static/scripts/admin_mailbox.js:2396`。
- 契约测试：`F:/maildrop-master/tests/test_ui_refactor_contract.py:298`。

## 4. 隔离验证方法与实际覆盖

验证脚本：`F:/maildrop-master/scripts/verify_ui_browser.py:49`。

- 每次新进程创建独立临时 SQLite 数据库，预先设置测试环境变量，断言真实数据库路径在本次临时目录内。
- 仅绑定 `127.0.0.1` 的 Web 服务；不运行 `app.py`，不启动 SMTP 或业务清理任务。
- 仅使用 `example.test` / `studio.test` 合成账号/邮件/管理员；真实登录、创建、查询、已读和删除均只作用于临时库。
- 包含空邮箱、错误密钥、不存在、过期、停用、长地址/主题、安全/恶意 HTML、白名单图标、API 鉴权/网络错误、创建结果和后台弹窗。
- 所有浏览器请求限制在本机，外部资源请求会被拦截并记为失败；不放宽产品 CSP。
- WebKit 截图同步会临时注入 `body {}` 样式（已读取 Playwright 1.57.0 驱动并隔离复现），严格 CSP 拒绝该工具样式。只将截图期间精确匹配的该诊断单独保留，截图前或其他错误仍判失败，不放宽产品策略。复现证据：`F:/maildrop-master/reports/ui-redesign/webkit-screenshot-probe.json`。
- 测试前后比对前端源代码 SHA-256。关闭服务器、回收 SQLite 连接并真实清理本轮临时目录后，才写入 cleanup 成功证明。

**每轮配置：**
- Chromium：320 / 360 / 390 / 768 / 1024 / 1440 / 1920px，四种已解析主题情况 × 13 个界面 = **364** 组合。
- Firefox、WebKit：390 / 1440px，显式浅/深色 × 13 个界面，各 **52** 组合。
- 合计 **468** 页面组合；另外 **116** 复杂状态/文字放大/待处理检查（含 320px 阅读操作专测）。
- 每内核 **12** 组真实交互回归，三内核均执行，不把“能打开页面”当成功能通过。
- 每轮 **242** 次 axe 审查（0 个 violations，保留人工 incomplete）、**272** 张原始截图（含 WebKit 原生画面）；另生成总览和局部裁图供人工复核。
- 200% 是独立增大计算字号/行高的文字放大模拟，不声称替代 OS 字体设置、原生全页缩放或屏幕阅读器实机审计。

环境固定为 Python 3.14.2、Flask 3.1.2、Playwright 1.57.0、axe-core 4.11.0；Chromium 143.0.7499.4、Firefox 144.0.2、WebKit 26.0。以上为本次实测版本，不称为“最新版本”。

### 最终两轮记录

| 最终轮次 | 实测时间（UTC） | 页面组合 | 复杂状态 | 真实交互 | axe / 原始截图 | 结果与清理 |
| --- | --- | ---: | ---: | --- | --- | --- |
| final-round-8 | 2026-10-07 16:46:27～16:50:23 | 468 | 116 | Chromium / Firefox / WebKit 各 12 组通过 | 242 次 / 272 张 | 0 个失败；Web 退出、临时库删除；SMTP/业务清理未启动 |
| final-round-9 | 2026-10-07 17:10:46～17:14:17 | 468 | 116 | Chromium / Firefox / WebKit 各 12 组通过 | 242 次 / 272 张 | 0 个失败；Web 退出、临时库删除；SMTP/业务清理未启动 |

源码指纹：`d440c01f7516d4f8e93ffa54f14046170cca1b15bb0642254f635d3c0aaa0fb3`。

**连续两轮复核结论：**在同一冻结前端源码上，两次独立进程的完整验证均通过；实际查看了每轮 12 张 Chromium/WebKit 浅深色、桌面/手机总览，以及 320px 阅读、200% 文字、后台弹窗和原生占位文字局部。八个指定维度在本次范围内均未发现新的明显问题，未因此增加无用途的抽象、框架或装饰。

每轮 `visual-review.json` 保留逐维度依据、实际查看文件列表、32 个 WebKit 占位读取人工项和 4 个截图工具诊断。可见占位由原生绘制核对，隐藏字段只核对共享声明，不冒称逐字见于截图。对全页长截图中的固定弹窗，另用真实 390×844 视口复核：创建结果弹窗顶部约 67.52px、高约 708.95px，复制/打开操作均可见；证据为 final-round-8 的 `manual-dialog-probe.json` 和 `manual-390-*-register-success-viewport.png`。人工结论不代替用户视觉验收。

早期 discovery、acceptance-1、final-round-1～7 的资料保留作为排错过程，不冒充最终验收；其中测试样本互相删除、调试注入进沙箱、WebKit 返回焦点、名称匹配和阅读按钮排版等发现均经过修正/重新验证。

### 源码检查与退出状态

- 全量单元测试 **40 passed、139 subtests passed**，UTF-8 环境运行，无线程/解码警告；日志见 `F:/maildrop-master/reports/ui-redesign/final-unit.log`。
- **7** 个前端 JavaScript 文件语法检查通过；验证脚本 Python 编译及 Ruff E/F（79 字符行宽）检查通过。
- `git diff --check` 无空白错误；仅 Git 在 Windows 提示未来 LF→CRLF 转换，不改变全局配置。
- `app.py`、`src/backend`、`config.py`、运行依赖 `requirements.txt`、`.env`、`data` 没有本任务的代码改动；最终工作区变更清单仅为前端、两项契约测试、开发验证与文档。
- 固定本机预览端口 **8765/8766/8767/8768 均无监听**；两轮随机端口 Web 停止/临时数据清理成功写在各自报告中；本任务打开的调试页已关闭，既有用户页未关闭。
- 汇总证据：`F:/maildrop-master/reports/ui-redesign/verification-summary.json`。

### 对比度与自动工具边界

基于实际设计令牌计算：浅色正文/表面 15.38:1、次级文字/表面 5.58:1、主按钮文字 6.87:1；深色分别为 14.32:1、8.29:1、12.18:1。强输入边界最低约 3.01:1。危险/警告/信息的正常文字与对应底色均超过 4.5:1。

占位颜色在 Chromium/Firefox 读取真实伪元素样式；实测 WebKit 26.0 查询返回父输入正文颜色（不是实际占位颜色），因此明确记录为人工项，而非伪称自动通过。以其原生截图和同源 CSS 声明复核，查询证据在 `F:/maildrop-master/reports/ui-redesign/placeholder-accessor-probe.json`。

两轮各保留 30 条 color-contrast、4 条 frame-tested、4 条 label-content-name-mismatch 的 `incomplete` 规则记录（不是 violations 数量）。自动扫描包含 WCAG 相关 A/AA 标签及 best-practice，显式启用可见标签/辅助名称匹配。对 `incomplete` 不伪称自动通过：原生 textarea/placeholder、部分叠层背景的对比度人工检查；关闭符号 × 是已命名的图标操作；邮件 iframe 属于不可信内容隔离区，另以实际沙箱/脚本/外部请求测试验证。无障碍自动扫描并非完整 WCAG 认证。

补充 Lighthouse 13.4.1 最终源码桌面快照：登录、收件、创建门禁、API、后台门禁，无障碍均 **100**，无障碍类别无失败。其报告位于 `F:/maildrop-master/reports/ui-redesign/lighthouse-final-source`。快照执行时限时 Web 已结束，涉及在线端点的 robots.txt / llms.txt 读取在 SEO/agentic 检查中另有失败；不把它们隐藏或声称全类别满分，已保留原始报告。不使用带扩展的日常 Chrome 性能分数作为性能证据；最终同源验证以最后两轮报告为准。

## 5. 性能：只报告受控实验数据

独立 Chromium、390×844、4 倍 CPU 降速、150ms 延迟、下载 1.6Mb/s / 上传 0.75Mb/s、每次新上下文且禁用缓存。每页面三次取中位数，验收阈值 LCP ≤2500ms、CLS ≤0.1。

| 实测入口 | 第 8 轮 LCP 中位数 | 第 9 轮 LCP 中位数 | 两轮 CLS 中位数 | 阈值结果 |
| --- | ---: | ---: | ---: | --- |
| 公开登录 | 812ms | 776ms | 0.000 / 0.000 | 通过 |
| 真实收件工作台 | 844ms | 816ms | 0.000 / 0.000 | 通过 |
| 公开创建门禁 | 824ms | 792ms | 0.000 / 0.000 | 通过 |
| 只读 API 调试台 | 944ms | 884ms | 0.000 / 0.000 | 通过 |
| 后台登录门禁 | 1016ms | 1000ms | 0.000 / 0.000 | 通过 |

注册/后台性能测试测的是首次进入的门禁，不冒称认证后全部表格/表单的加载成绩。点击事件持续时间只作为实验记录；没有真实用户 RUM 数据，因此不声称已获得现场 INP 或现场 Core Web Vitals 达标。生产反向代理、带宽、硬件和真实邮件内容也可能影响结果。

## 6. 安全与功能保持

- 接口路径、原有 DOM 交互入口、管理权限、创建模式及真实批量计数语义保持。
- 公开页面仍是仅收信；不增加发送、回复、转发或生产测试投递。
- 邮箱密钥不写入 localStorage/sessionStorage；访问 URL 仍含密钥，保留 no-referrer 和明确的链接保护提示，未改变认证架构。
- 收件令牌仍只按原契约在内存/当前会话；API 调试令牌仅在运行时内存，输出不回显令牌；后台会话仍遵循原 sessionStorage 契约。
- HTML 邮件保留无权限 sandbox 的 iframe、清洗及资源限制；恶意脚本/图片/iframe/form 测试未执行或访问外部。
- 未访问或控制用户已有的生产浏览器页面；所有交互验证只针对本任务创建的本机测试页面。

## 7. 本地证据与复现

- 说明：`F:/maildrop-master/docs/ui-awards-redesign.md`。
- 最终两轮 JSON：`F:/maildrop-master/reports/ui-redesign/final-round-8/report.json`、`F:/maildrop-master/reports/ui-redesign/final-round-9/report.json`。
- 两轮原始截图、`overview-*` 总览与 `visual-review.json` 在相同目录；`F:/maildrop-master/reports/ui-redesign/showcase.png` 采用第 9 轮实际截图拼接，不是虚构功能效果图。
- 单元测试日志：`F:/maildrop-master/reports/ui-redesign/final-unit.log`。
- 报告和 `.ui-qa` 为本地忽略目录，不把合成账号、数据库、截图缓存混入 Git；可按以下命令重新生成。

```powershell
Set-Location -LiteralPath 'F:\maildrop-master'
$env:PYTHONUTF8='1'
$env:PYTHONIOENCODING='utf-8'
$env:PYTHONDONTWRITEBYTECODE='1'
python -m pip install -r F:\maildrop-master\requirements.txt
python -m pip install -r F:\maildrop-master\requirements-dev.txt
# 保留用户已有浏览器缓存，不让安装器清理其他任务使用的版本。
$env:PLAYWRIGHT_SKIP_BROWSER_GC='1'
python -m playwright install chromium firefox webkit
npm install --prefix F:\maildrop-master\.ui-qa --no-save --no-audit --no-fund axe-core@4.11.0
python -m pytest -q
python F:\maildrop-master\scripts\verify_ui_browser.py --output reports/ui-redesign/recheck
```

快速检查：`--quick --skip-perf`；集中状态检查：`--states-only --skip-perf`。本机限时预览：`--serve 180 --port 8767`。这些方式仍使用独立临时数据库；不要用 `python app.py` 替代隔离验证。

## 8. 限制、残留与验收

- 不含生产部署、SMTP 投递验证、真实数据压力测试、第三方奖项评审或屏幕阅读器实机认证。
- 每次最终完整轮次已核实自己的服务器退出和临时库清理；固定预览端口退出情况见最终检查记录。
- **一处早期测试残留尚在：**`C:/Users/59537/AppData/Local/Temp/maildrop-ui-dwvglv76`。其来源是初次验证的 SQLite 连接释放问题，只有合成测试数据。工具规则拒绝了该旧目录的删除请求，未换方式绕过；因此不声称所有历史临时目录都已清空。后续清理已修正，该旧目录需用户另行处理。
- 用户于 **2026-10-07 17:27:50 UTC** 在三术验收面板实际选择“验收完成，结束本次任务（推荐）”。验收记录：`F:/maildrop-master/reports/ui-redesign/acceptance-receipt.json`。此确认不授权提交 Git 或生产部署。
