# 米立墙壁开关接入 Home Assistant（小白版）

这份说明适合把自己拥有的米立 Zigbee 墙壁开关，从米立原网关迁移到
Zigbee2MQTT 和 Home Assistant。

空调集中控制器 PR5Y 与普通墙壁开关不是同一种设备。PR5Y 请回到主
`README.md` 按专用 converter 流程操作。

## 1. 已验证的三路开关类型

目前有一只三路市电墙壁开关完成了基础接入：

```text
Zigbee model: TS0003
manufacturer: _TZ3000_juccdfpb
endpoint 1: left
endpoint 2: center
endpoint 3: right
```

Zigbee2MQTT 能原生识别这个指纹，不需要安装自定义 converter。加入后通常出现：

```text
state_left
state_center
state_right
linkquality
```

`linkquality` 是无线信号诊断，不是第四路开关。

外壳和 App 名称相同，不代表内部指纹一定相同。自己的设备必须在加入后重新核对
`modelID` 和 `manufacturerName`。

## 2. 迁移前准备

1. 在米立 App 中记下设备名称和房间。
2. 记录左、中、右三路分别控制什么。
3. 记录与该开关有关的场景和自动化。
4. 给面板、铭牌和当前接线拍照。
5. 确认知道该批次如何进入配网和恢复出厂。
6. 保留重新加入米立原网关的办法。
7. 选择一个非关键开关，在白天有人在场时操作。

不要一次重置全屋开关。一个设备完成全部测试后，再决定是否迁移下一个。

## 3. 加入 Zigbee2MQTT

1. 确认 Zigbee2MQTT 和协调器在线。
2. 在 Zigbee2MQTT 打开 Permit join，只开放 2-5 分钟。
3. 按该型号的原厂说明，让这一只开关进入配网或恢复出厂模式。
4. 等待设备 interview 成功。
5. 立即关闭 Permit join。
6. 核对设备指纹和三路 exposes。

不同批次的物理按键流程可能不同，本教程不猜测“长按几秒”或“连续按几次”。

## 4. 在 Home Assistant 中整理

Zigbee2MQTT 开启 HA 集成后，MQTT Discovery 通常会自动创建三路 switch。

接下来：

1. 在 HA 找到该设备。
2. 分别确认 left、center、right 控制的真实负载。
3. 把实体改成家人能理解的名字，例如“餐桌灯”“灯带”。
4. 给设备和实体分配正确房间。
5. 不要把 left、center、right 直接作为最终显示名称。

## 5. 三路验收表

一次只测一路：

1. HA 开启，确认正确负载打开。
2. HA 关闭，确认正确负载关闭。
3. 物理按键开启，确认 HA 状态变为开。
4. 物理按键关闭，确认 HA 状态变为关。
5. 确认另外两路没有误动作。

三路都完成后，再做一次安全的断电恢复测试：

1. 记录三路当前状态。
2. 按正常配电操作断电和恢复，不拆面板、不碰接线。
3. 确认物理按键恢复。
4. 确认设备重新上线。
5. 确认 HA 状态与实际负载一致。

任何一路未完成测试，都应标记为“待验收”，不能因为设备已经出现在 HA 就视为完成。

## 6. 加入 Apple Home

完成三路验收和重命名后，再通过 HA HomeKit Bridge 发布需要的三路 switch。

- 三路在 Apple Home 中显示为三个按钮是正常的。
- 把三路放在正确的 Apple Home 房间。
- 不发布 `linkquality`、固件、配置和诊断实体。
- Siri 名称应使用真实用途，避免三路都叫“开关”。

如果一路实际控制灯，可以先作为普通开关使用。需要灯光图标和灯光自动化时，可在
HA 创建 Template Light，再隐藏原始 switch，避免 Apple Home 出现两个重复控制。

## 7. 什么时候需要 converter

已验证的 `TS0003 / _TZ3000_juccdfpb` 基础三路功能不需要 converter。

只有出现以下情况时才进入协议分析：

- Zigbee2MQTT 显示 unsupported device。
- 只出现部分按键。
- 软件能控制，但物理状态不回报。
- 日志提示没有可用 converter。

先保存 fingerprint、endpoint、cluster、exposes 和 debug 日志，再使用
`external_converters/mili-onoff-probe.example.js` 生成最小开关探针。模板中的
型号都是占位符，必须换成日志里的真实值。PR5Y converter 只适用于空调集中器，
绝不能套到墙壁开关。

## 8. 回退

迁移失败时：

1. 停止继续迁移其他设备。
2. 保存 Zigbee2MQTT 日志。
3. 从测试网络移除这一只设备。
4. 按原厂流程让它重新加入米立网关。
5. 恢复原名称、房间和必要自动化。
6. 再次确认物理按键可靠。

回退成功比勉强把设备留在不稳定状态更重要。
