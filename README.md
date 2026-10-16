# SchoolDay Homepage

欧阳的个人主页 - 项目导航与工具集合

## 🌐 在线访问
- 主页：https://schoolday.cc.cd

## 📁 项目列表

各项目独立部署，通过主页导航访问：

- **个人作品集** - 6年 WebGIS 开发经历展示
  - 访问：https://schoolday-site.pages.dev
  - 仓库：https://github.com/change-ouyang/schoolday-site

- **3x-ui 节点面板** - 节点管理面板：多协议入站、流量统计与多用户配额
  - 访问：https://3x-ui.schoolday.cc.cd/page/panel
  - 需登录

- **Komari 服务器监控** - 多机在线率、负载、内存与流量的实时看板
  - 访问：https://komari.schoolday.cc.cd
  - 需登录

- **CPAMP 管理面板** - 自托管的 CLIProxyAPI 管理面板：请求记录、用量与成本分析、配额与账号健康度
  - 访问：https://cpamp.schoolday.cc.cd
  - 需登录

- **New API 网关** - 大模型 API 统一网关：多上游渠道、密钥与额度管理、用量统计
  - 访问：https://newapi.schoolday.cc.cd
  - 需登录

- **CrowdSec 入侵防护** - 基于社区威胁情报的入侵检测与 IP 封禁：告警、决策与拦截记录
  - 访问：https://crowdsec.schoolday.cc.cd
  - 需登录

## 🔒 安全与访问控制

**主页本身不做访问控制。** 它是纯静态公开页面 —— 卡片里的地址在 HTML 源码中直接可见（`Ctrl+U`，或 `curl https://schoolday.cc.cd`）。前端加「登录页」只是障眼法：源码照样能读，JS 判断可以绕过，内容也已经发到对方浏览器里了。真正的拦截必须发生在内容发出**之前**（见下面的 Cloudflare Access）。

另外，子域一旦签发 TLS 证书就会进入 **Certificate Transparency 日志**（`crt.sh` 查 `%.schoolday.cc.cd` 即可列出全部子域）。所以「地址没公开就安全」这个假设不成立 —— **真正的防线是各服务自身的登录与加固**。

### 各服务加固清单

**3x-ui 节点面板**
- 改掉默认账号密码（默认 `admin` / `admin`）—— 公网面板被扫的第一目标
- 面板路径已自定义为 `/page/panel`，继续保持，不要用默认 `/`
- 面板设置里开启登录告警与失败次数限制；若版本支持则开启二次验证
- 跟随上游 release 更新，安全修复通常先发在那里

**Komari 服务器监控**
- 后台强密码；它是唯一按「公开看板」设计的服务，但仍要区分「公开可见的内容」与「后台控制权」
- 只公开必要信息：节点名用别名，隐藏真实 IP 与地理位置
- 跟随上游更新

**CPAMP 管理面板**
- 后台强密码；它持有上游账号凭据（Codex / xAI 的 OAuth 与密钥）—— 这个面板泄露约等于那些账号一起泄露
- 权限比其余几个更重，建议用 Cloudflare Access 或 IP 白名单收进内网
- 跟随上游 release 更新

**New API 网关**
- 立刻改掉默认 `root` / `123456`（默认口令，公网实例会被批量尝试）
- **关闭自由注册**，否则任何人都能注册后消耗你的上游额度
- 给令牌设额度与过期时间；上游渠道密钥只留在服务端，不要出现在任何前端代码里
- 若版本支持，开启 Cloudflare Turnstile 人机验证

**CrowdSec 入侵防护**
- 后台 / Web UI 强密码
- **不要把 LAPI（本地 API，默认 8080）暴露到公网** —— 它只应被同机或内网的 bouncer 访问
- 定期 `cscli hub update && cscli hub upgrade` 更新 scenarios / collections；接 Telegram 或邮件告警
- 确认 bouncer 真的装上并生效：只在后台看告警、不装 bouncer = 只看不拦

### 可选：Cloudflare Access（真拦截）

想把上面这些面板挡在登录之后，用 Cloudflare Zero Trust 的 Access —— 未登录者连 HTML 都拿不到：

1. Cloudflare 后台 → **Zero Trust** → **Access** → **Applications** → **Add an application** → **Self-hosted**
2. Application domain 填要保护的主机名，如 `3x-ui.schoolday.cc.cd`；想一次覆盖全部子域可用通配符 `*.schoolday.cc.cd`
3. Session Duration 按需设置（如 24 hours）
4. **Add a policy**：Action = `Allow`，Include = `Emails` = 你的邮箱
5. Identity provider 选 **One-time PIN**（邮箱验证码）—— 无需接任何外部 IdP，也不额外花钱
6. 保存后，访问该主机名需先通过邮箱验证码，通过后才拿到内容。**面板自身的登录依然保留**（两层，不是替代关系）

> 两个容易搞混的点：
> - 用 `*.schoolday.cc.cd` 保护子域**不影响**门户 `schoolday.cc.cd` 本身；反过来，**若要门户私有化，就给 `schoolday.cc.cd` 单独加一条 Access 规则** —— 页面代码一行都不用改。
> - 记得给 **Cloudflare 账号本身**开 2FA：它才是能改动这一切的总开关。

## 🚀 本地预览

双击 `启动SchoolDay站点.bat` 或运行：

```bash
python -m http.server 8000
```

访问 http://localhost:8000

## 📦 部署

### Cloudflare Pages
1. 连接 GitHub 仓库
2. 构建设置：
   - 框架预设：None
   - 构建命令：留空
   - 构建输出目录：`/`
3. 自定义域名：schoolday.cc.cd

## 🎨 技术栈
- 纯静态 HTML/CSS/JavaScript
- 响应式设计
- 亮暗主题切换
- 科技感 UI 设计
