# 米立开关与空调改造：从购买到使用的人类指南

这份文档只按普通人的操作顺序来写。你不需要先学会 Docker、MQTT 或 Zigbee
协议，只需要知道自己现在在哪一步，以及哪个界面该做什么。

目标是：

```text
米立墙壁开关和中央空调
  -> Home Assistant 统一管理
  -> Apple Home 和 Siri 日常使用
```

如果你准备把实施过程交给 AI，先看第 11、12 节。

## 1. 开始前先判断

这套方案适合：

- 设备属于你自己，你能接触设备并执行配网或复位。
- 你愿意保留米立原网关作为回退手段。
- 家里有稳定的局域网。
- 可以放置一台长期通电的 Home Assistant 主机。
- 现场有人能观察灯、开关和空调面板。

暂时不要开始：

- 不知道开关每一路控制什么。
- 无法接触设备，也无法恢复原网关。
- 准备一次性重置全屋开关。
- 空调正在高频使用，不能安排安全测试时间。
- 家里网络本身还经常断线。
- 需要拆墙壁开关、修改强电接线或处理未知空调总线。

本文只处理软件接入和已安装设备的正常配网。强电和空调控制线应由有资质人员处理。

## 2. 先盘点家里已经有什么

开始购买前，填写这张表：

| 项目 | 你家的情况 |
| --- | --- |
| 米立网关型号 | 例如 TS-G9134G |
| 米立墙壁开关数量 |  |
| 第一个测试开关位置 | 选非关键位置 |
| 开关型号和铭牌 | 拍照 |
| 是否有 PR5Y 空调控制器 | 有 / 没有 / 不确定 |
| PR5Y 的 Zigbee 指纹 | 配对后确认 |
| Home Assistant | 已有 / 没有 |
| 可长期运行的主机 | 已有 / 没有 |
| 可用网口 | 有 / 没有 |
| PoE | 交换机支持 / 需要注入器 / 不使用 |
| Apple Home | 已在用 / 不使用 |
| HomePod mini 或 Apple TV | 有 / 没有 |

不要因为外壳一样就先买一批开关。米立、Tuya 产品可能在相同外壳里使用不同
Zigbee 指纹。

## 3. 建议购买什么硬件

以下只是建议，不是必须照单购买。

### 3.1 必需：Home Assistant 主机

三选一：

#### 方案 A：Home Assistant Green

适合希望少折腾系统、主要在网页中操作的人。Home Assistant 官方把 Green 作为
多数人的推荐起点：

[Home Assistant Green](https://www.home-assistant.io/green)

还需要在 HA 中安装 MQTT Broker 和 Zigbee2MQTT。

#### 方案 B：现有 NAS 或小主机

如果 NAS 支持 Docker，或家里已有 Intel/AMD 小主机，可以继续使用，不必重复购买。

建议留出：

- 4 GB 内存可以起步，8 GB 更宽松。
- SSD 至少 64 GB，建议 128 GB 或更大。
- 一个稳定有线网口。
- 自动开机和断电恢复能力。

这些容量是本方案的实用建议，不是 HA 官方最低规格。

#### 方案 C：旧电脑或路由软主机

可以使用，但不建议小白把主路由、存储、HA、实验服务一次全部混在同一台机器。
任何一个服务出错都可能影响全家上网。

### 3.2 必需：Zigbee 协调器

本方案验证过：

```text
SMLIGHT SLZB-06MU
Ethernet / PoE 连接
EFR32MG21
Zigbee2MQTT adapter: ember
```

它的作用类似“Zigbee 天线和总网关”。SMLIGHT 官方说明该系列支持 Ethernet、
Wi-Fi 和 USB，Ethernet 模式常用端口为 6638：

[SMLIGHT SLZB-06 系列手册](https://smlight.tech/manual/slzb-06/)
[SMLIGHT Ethernet 安装说明](https://smlight.tech/manual/slzb-06/guide/installation/)

购买前确认：

- 具体型号仍在 Zigbee2MQTT 支持列表中。
- 芯片和教程一致。
- 商家没有用近似名称销售不同硬件版本。

不想使用 SMLIGHT 也可以选择 Zigbee2MQTT 官方支持的 EmberZNet 或 zStack
协调器。Zigbee2MQTT 官方列出的基础硬件就是协调器、运行主机和 Zigbee 设备：

[Zigbee2MQTT Getting started](https://www.zigbee2mqtt.io/guide/getting-started/)

### 3.3 连接和供电

根据家里情况选择：

- 一根质量可靠的网线。
- 支持对应标准的 PoE 交换机。
- 或一个兼容的 PoE 注入器。
- 不使用 PoE 时，准备稳定的 USB 电源。

协调器不要放在金属机柜深处、路由器天线旁边或强干扰源旁边。可以用网线把它放到
更开阔的位置。

### 3.4 可选：Apple 家庭中枢

如果只在家里用 iPhone 控制，Apple Home 本身不是必须购买新硬件的理由。

需要以下能力时，建议准备 HomePod mini、HomePod 或兼容 Apple TV：

- 离家后远程控制。
- Apple Home 家庭自动化。
- 更稳定的 Siri 家庭控制。
- 与家人共享家庭。

Apple 官方说明 HomePod 和 Apple TV 可作为家庭中枢：

[设置 Apple 家庭中枢](https://support.apple.com/en-gb/102557)
[使用 Siri 控制家庭](https://support.apple.com/en-us/105027)

### 3.5 不要急着买

- 不要先买大量同型号米立开关。
- 不要为了这个方案再买第二个米立原网关。
- 不要在还没有建立基础 Zigbee 网络时先买一堆中继器。
- 不要购买来源不明、型号近似的协调器。
- 不要购买 PR5Y 来控制原本不兼容的中央空调系统。

PR5Y 必须与现有空调控制总线和面板匹配，它不是通用红外遥控器。

## 4. 需要满足什么软件环境

整套系统需要四个软件角色：

| 软件 | 作用 | 是否必需 |
| --- | --- | --- |
| Home Assistant | 全屋智能总管 | 必需 |
| Mosquitto MQTT | HA 和 Zigbee2MQTT 之间传消息 | 必需 |
| Zigbee2MQTT | 管理 SLZB 和 Zigbee 设备 | 必需 |
| Apple Home | 家人 UI 和 Siri | 可选 |

还需要：

- 一台电脑和现代浏览器，用于配置网页。
- 能编辑文件或让 AI 编辑文件。
- 使用本包生成 PR5Y 配置时，需要 Node.js 18 或更高版本。
- HA、Zigbee2MQTT、MQTT 和 SLZB 能在同一家庭局域网互相访问。

### 为什么用 Zigbee2MQTT，不用 ZHA

普通开关可能两者都能支持，但本方案的 PR5Y 空调依赖 Zigbee2MQTT external
converter。因此整套教程统一使用 Zigbee2MQTT。

同一个协调器不能同时交给 ZHA 和 Zigbee2MQTT。二选一。

### 安装顺序

```text
Home Assistant
  -> Mosquitto MQTT
  -> Zigbee2MQTT
  -> SLZB-06MU
  -> 一个测试开关
  -> PR5Y 空调
  -> Apple Home
```

不要跳过测试开关直接改全屋或空调。

## 5. 你会操作哪些网页

把下面地址替换成自己家里的地址：

| 界面 | 常见地址 | 用途 |
| --- | --- | --- |
| 路由器管理页 | `http://ROUTER_IP` | 查设备、固定 SLZB 地址 |
| SLZB 管理页 | `http://SLZB_IP` | 检查供电、模式和端口 |
| Zigbee2MQTT | `http://HA_HOST:8080` 或 HA 侧栏入口 | 配网、设备、日志 |
| Home Assistant | `http://HA_HOST:8123` | 房间、设备、自动化 |
| Apple Home | iPhone、iPad 或 Mac 的“家庭”App | 家人控制和 Siri |

不同路由器、HA 安装方式和 Zigbee2MQTT 前端版本的按钮名称可能略有不同。

## 6. 第一次搭建：按界面操作

### 6.1 路由器管理页

目标：让 SLZB 每次开机都得到同一个 IP。

1. 把 SLZB 用网线接入家庭局域网并供电。
2. 打开路由器管理页。
3. 找到“客户端列表”“DHCP 客户端”或“已连接设备”。
4. 找到名称类似 `slzb` 或与设备标签 MAC 一致的设备。
5. 创建“静态 DHCP”“地址保留”或“固定租约”。
6. 记下分配的 IP。
7. 重启 SLZB 后确认地址没有变化。

还要确认：

- 没有开启会隔离有线和 Wi-Fi 客户端的“访客隔离”。
- 运行 HA 的主机可以访问 SLZB。
- iPhone 和 HA 配对 HomeKit 时位于同一个局域网。

### 6.2 SLZB 管理页

目标：确认它作为 Zigbee Ethernet 协调器工作。

1. 在浏览器打开刚才记录的 SLZB IP。
2. 首次使用时设置管理密码。
3. 检查运行模式是 Ethernet 或 LAN Zigbee coordinator。
4. 记下 Zigbee socket 端口，常见为 `6638`。
5. 确认 Zigbee 芯片和购买型号一致。
6. 先不要频繁升级固件或切换 Zigbee/Thread 模式。

最终需要得到类似信息：

```text
SLZB IP: 192.168.x.x
Socket: tcp://192.168.x.x:6638
Adapter: ember
```

### 6.3 Home Assistant

目标：先让 HA 本身稳定，再接设备。

1. 打开 HA。
2. 创建管理员账号。
3. 在“设置 > 系统 > 备份”创建第一次完整备份。
4. 设置家庭名称、时区和单位。
5. 温度单位选择摄氏度。
6. 不要一开始导入全部米家设备和自动化。

### 6.4 Mosquitto MQTT

HA OS 用户优先从 HA 的 App 商店安装 Mosquitto Broker。官方 MQTT 文档把本地
Mosquitto 作为最容易和最私密的方案：

[Home Assistant MQTT](https://www.home-assistant.io/integrations/mqtt/)

然后在 HA：

1. 打开“设置 > 设备与服务”。
2. 点击“添加集成”。
3. 搜索 `MQTT`。
4. 输入 Broker 地址、端口、账号和密码。
5. 完成后确认 MQTT 集成显示正常。

不要使用公网免费 MQTT Broker 管理家里的开关和空调。

### 6.5 Zigbee2MQTT

按自己的平台安装 Zigbee2MQTT：

[Zigbee2MQTT 安装方式](https://www.zigbee2mqtt.io/guide/installation/)

首次引导页通常需要填写：

```text
MQTT server: mqtt://MQTT_HOST:1883
Serial port: tcp://SLZB_IP:6638
Adapter: ember
Frontend: enabled
Home Assistant integration: enabled
```

建议：

- Zigbee channel 初次可以从 20 开始，再结合家里的 2.4 GHz Wi-Fi 评估。
- 一旦加入正式设备，不要随便更改 channel。
- 为 Zigbee 网络生成随机 `network_key`。
- 备份 `configuration.yaml` 和 `database.db`。
- Zigbee2MQTT 前端只允许家庭内网访问，并设置访问保护。

Zigbee2MQTT 官方说明 Permit join 应只临时开启，设备加入后立即关闭：

[Zigbee2MQTT 安全说明](https://www.zigbee2mqtt.io/advanced/zigbee/03_secure_network.html)

## 7. 先用一只米立开关验收

不要先动 PR5Y。先选择一个非关键墙壁开关：

1. 在米立 App 记录名称、房间、三路用途和自动化。
2. 在 Zigbee2MQTT 点击 Permit join。
3. 按该批次说明书让开关进入配网。
4. 等待设备显示 interview 成功。
5. 立即关闭 Permit join。
6. 核对 Zigbee model 和 manufacturer。
7. 在 HA 找到自动发现的开关实体。
8. 测试软件开、关。
9. 测试物理按键是否同步回 HA。
10. 测试另外几路没有误动作。
11. 最后测试正常断电恢复。

已验证的 `TS0003 / _TZ3000_juccdfpb` 三路开关基础功能不需要自定义
converter。详细验收表见 `docs/MILI-SWITCH.md`。

## 8. 接入米立 PR5Y 空调

只有测试开关和基础 Zigbee 网络稳定后再做。

### 8.1 先配对

1. 在米立 App 记录所有房间空调状态。
2. 保留米立原网关回退能力。
3. 在 Zigbee2MQTT 短时开启 Permit join。
4. 按 PR5Y 对应说明书进入 Zigbee 配网。
5. 等待 interview 成功并关闭 Permit join。

必须核对：

```text
modelID: TS0603
manufacturerName: _TZF200_wkmsnr09
product identifier: rpk52nw5
```

指纹不同就停止使用本 converter。

### 8.2 生成配置

在本教程包目录：

```sh
cp config.example.json config.json
```

填写自己的 PR5Y IEEE、稳定名称和房间，再运行：

```sh
node tools/generate-config.mjs config.json build
```

不熟悉命令行时，把这一步交给 AI，不要在聊天中公开真实 IEEE、家庭地址和密码。

### 8.3 安装 converter

把生成的 `mili-hvac-pr5y.js` 安装到 Zigbee2MQTT 的 external converters。
Zigbee2MQTT 新安装可能默认限制 external JavaScript，需要按官方文档开启：

[Zigbee2MQTT external converters](https://www.zigbee2mqtt.io/advanced/more/external_converters.html)

然后：

1. 重启 Zigbee2MQTT。
2. 确认设备识别为 PR5Y。
3. 执行 `REGISTER` 注册内部空调。
4. 执行 `QUERY` 查询状态。
5. 核对实际出现的内部地址。

### 8.4 加入 HA

把生成的 `home-assistant-mqtt.yaml` 合并到 HA 配置。

1. 先做 HA 配置检查。
2. 检查通过后重启 HA。
3. 确认每个房间出现一个 Climate。
4. 一次只测试一个房间。
5. 目标温度只改变 1℃，确认后恢复。
6. 再测试风速和模式。
7. 不要快速反复开关空调。

## 9. 整理 Home Assistant

设备能控制后，先做整理：

1. 把设备放到正确房间。
2. 把 Left、Center、Zone 1 这类技术名称改为真实用途。
3. 隐藏 `linkquality`、raw DP、注册和查询等诊断实体。
4. 删除或禁用重复的米家云端实体。
5. 先在 HA 使用几天，再发布到 Apple Home。

HA 是完整功能入口。Apple Home 是简化后的家人入口，不要期待两个界面完全一样。

## 10. 加入 Apple Home

在 HA：

1. 打开“设置 > 设备与服务”。
2. 点击“添加集成”。
3. 搜索 `HomeKit Bridge`。
4. 选择 Bridge 模式。
5. 只加入整理好的开关和 Climate。
6. 完成后在 HA 通知中查看二维码或配对码。

HA 官方的 UI 路径和配对说明：

[Home Assistant HomeKit Bridge](https://www.home-assistant.io/integrations/homekit/)

在 iPhone：

1. 打开“家庭”App。
2. 点击“添加配件”。
3. 扫描 HA 显示的二维码。
4. 把设备分配到正确房间。
5. 使用简短、唯一、适合 Siri 的名称。

只发布：

- 已验收的米立开关实体。
- PR5Y 的 Climate。

不要发布：

- `linkquality`
- raw DP
- REGISTER、QUERY
- 固件、日志和诊断实体
- 同一物理设备的重复云端实体

## 11. 全权交给 AI 前，需要准备什么

AI 可以处理文件、配置、SSH、日志和网页，但不能替你按物理开关、看空调面板或处理
强电。

准备以下条件：

### 11.1 文件和环境

- 下载并解压本教程包。
- 让 AI 能读取该目录。
- 保留 `README.md`、`HUMAN-GUIDE.md`、`AGENTS.md` 和 `docs/`。
- 安装 Node.js 18 或更高版本。
- 准备一个专门的工作目录或 Git 仓库。

### 11.2 主机访问

推荐：

- 给 HA/Zigbee2MQTT 主机配置 SSH 别名。
- 使用 SSH key，不在提示词中粘贴密码。
- AI 首次只获得读取和备份能力。
- 需要部署或重启时再明确授权。
- 不给长期自治 Agent 路由器 root 或 NAS 任意命令权限。

### 11.3 网页访问

如果 AI 支持浏览器操作：

- 先由你登录路由器、SLZB、Zigbee2MQTT 和 HA。
- 不把账号密码直接发到对话中。
- 允许 AI 操作已登录页面。
- Apple Home 配对和二维码扫描仍由你现场完成。

### 11.4 现场资料

准备：

- 设备和铭牌照片。
- 米立开关每一路真实用途。
- PR5Y 和空调面板型号。
- HA、Zigbee2MQTT、SLZB 的内网地址。
- 当前网络拓扑。
- 哪只设备可以作为非关键测试样本。
- 哪些操作必须先询问你。

### 11.5 安全和回退

开始前必须有：

- HA 完整备份。
- Zigbee2MQTT 数据目录备份。
- 原米立 App 设备和自动化截图。
- 恢复米立原网关的办法。
- 现场有人配合。
- 明确禁止格式化磁盘、重建 Zigbee 网络和批量重置设备。

## 12. 推荐的第一条 AI 提示词

把下面内容中的方括号替换成自己的信息。密码、Zigbee network key、HomeKit
配对码不要写进提示词。

```text
你现在协助我把我自己拥有的米立 Zigbee 墙壁开关和 PR5Y 中央空调接入
Zigbee2MQTT、Home Assistant，并在稳定后发布到 Apple Home。

请先阅读当前目录中的：
1. HUMAN-GUIDE.md
2. README.md
3. AGENTS.md
4. docs/MILI-SWITCH.md
5. docs/PROTOCOL.md

我的环境：
- Home Assistant 地址：[HA 内网地址]
- Zigbee2MQTT 地址：[Z2M 内网地址]
- MQTT Broker：[MQTT 内网地址和端口]
- Zigbee 协调器：[型号]
- 协调器地址：[SLZB 内网地址]
- 运行主机：[HA Green / NAS / Linux 小主机 / 其他]
- SSH 入口：[SSH 别名，没有则写“暂无”]
- Apple Home：[使用 / 不使用]
- 可测试设备：[一个非关键米立开关的位置和用途]
- PR5Y：[有 / 没有 / 尚未确认]

工作方式：
- 先只读检查现状，给出事实清单，不要立即修改。
- 先备份，再一次只修改一层。
- 不同时修改路由、DHCP、DNS、Docker、MQTT、Zigbee 和 HA。
- 不扫描或控制不属于我的设备。
- 不删除 Zigbee 数据库、HA .storage、Docker volumes 或磁盘分区。
- 不改变 Zigbee channel，除非先说明影响并得到我授权。
- 不主动开关空调或切换制冷/制热，除非先告诉我将操作哪个房间。
- 所有物理按键、断电和面板确认由我完成；需要时给我一条明确动作并等待回复。
- 每完成一步都验证，并记录回退方法。
- 把确认后的家庭事实写入私有文档；公开教程中不得出现我的 IP、MAC、IEEE、
  房间名、家庭成员、密钥或配对码。

第一阶段请完成：
1. 检查 HA、MQTT、Zigbee2MQTT 和协调器是否在线。
2. 检查数据目录、备份和当前 Zigbee 配置。
3. 确认协调器没有同时被 ZHA 和 Zigbee2MQTT 使用。
4. 给出第一个非关键米立开关的安全迁移步骤。
5. 在执行任何修改前向我汇报检查结果。
```

## 13. 你和 AI 怎么配合

理想节奏：

```text
AI：请让测试开关进入配网模式，完成后回复“已操作”。
你：已操作。
AI：检查日志和设备指纹，只汇报结果。
AI：请按一次中间按键，完成后回复“已按”。
你：已按。
AI：确认状态回报，再安排下一路。
```

不要让 AI 一次给你十个现场动作。一个动作、一次观察、一次记录最可靠。

AI 不能替代的判断：

- 物理灯是否真的亮了。
- 空调面板显示了什么。
- 风速听起来是否变化。
- 哪一路开关对应哪个负载。
- 是否适合此刻启停压缩机。
- 是否需要电工或空调专业人员。

## 14. 完成标准

### 米立开关

- 软件可以分别控制每一路。
- 每个物理按键都会正确回报 HA。
- 不会误动另外一路。
- 断电恢复后仍可用。
- 实体名称和房间正确。
- Apple Home 只出现日常实体。

### PR5Y 空调

- 每个房间映射正确。
- 物理面板和 HA 状态一致。
- 开关、整数温度、模式和三档风速闭环。
- HA 重启后状态能恢复。
- Apple Home 只出现四个 Climate。
- 跨模式切换不会同时保留两个模式指示。
- 没有快速反复启停压缩机。

### 整体系统

- Permit join 已关闭。
- 配置和数据已备份。
- 原厂网关回退路径仍在。
- 家人仍可使用物理开关和面板。
- 网络或 AI 故障不会破坏基本控制。
