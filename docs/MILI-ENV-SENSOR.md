# 米立六合一环境探测器接入 Home Assistant

本文适用于下面这个已经通过真实设备上报验证的 Zigbee 指纹：

```text
Zigbee model: TS0601
manufacturer: _TZE200_elpnedea
converter model: MILI-TS0601-ENV-6IN1
```

外壳、包装或原厂 App 名称相同，不代表内部指纹相同。指纹不一致时不要直接使用本
converter，应先保存设备信息和 debug 日志。

## 1. 支持的测量值

探测器会在 Zigbee2MQTT 和 Home Assistant 中提供六项只读数据：

| 数据 | Tuya DP | 换算 | 单位 |
| --- | ---: | --- | --- |
| PM2.5 | 2 | 原值 | µg/m³ |
| 照度 | 17 | 原值 | lx |
| 温度 | 18 | 原值除以 10 | ℃ |
| 相对湿度 | 19 | 原值 | % |
| PM1 | 23 | 原值 | µg/m³ |
| PM10 | 24 | 原值 | µg/m³ |

这些 DP 已在同一指纹的真实设备日志中重复观察到。converter 只读取数据，不向设备
写入阈值、校准值或其他未确认的 DP。

## 2. 加入 Zigbee2MQTT

1. 记录探测器在原厂 App 中的名称和当前读数。
2. 在 Zigbee2MQTT 中短时打开 Permit join，建议 2-5 分钟。
3. 按该批次说明书让探测器进入 Zigbee 配网模式。
4. 等待 interview 完成后立即关闭 Permit join。
5. 在设备“关于”页面核对 `TS0601 / _TZE200_elpnedea`。

配对后只看到 `linkquality`，并显示 unsupported device，是尚未安装 converter 的正常
表现。不要删除设备或重新建立 Zigbee 网络。

## 3. 安装 converter

把下面的文件复制到 Zigbee2MQTT 数据目录中的 `external_converters/`：

```text
external_converters/mili_env_sensor.js
```

Zigbee2MQTT 2.11.0 及以后版本默认关闭 external JavaScript。按官方文档启用
`enable_external_js` 后重启 Zigbee2MQTT。也可以在 Zigbee2MQTT 的
“设置 > 开发者控制台 > External converters”中保存同一文件。

启动日志应包含：

```text
Loaded external converter 'mili_env_sensor.js'
```

设备页应从 unsupported 变为 `MILI-TS0601-ENV-6IN1`，并出现 Temperature、Humidity、
Illuminance、PM1、PM25 和 PM10 六项数据。

官方参考：

- [Zigbee2MQTT external converters](https://www.zigbee2mqtt.io/advanced/more/external_converters.html)
- [Zigbee2MQTT exposes](https://www.zigbee2mqtt.io/guide/usage/exposes.html)

## 4. 在 Home Assistant 中确认

Zigbee2MQTT 开启 Home Assistant 集成后，MQTT Discovery 会自动创建六个 sensor。
逐项检查：

1. 温度单位是 `℃`，数值与探测器屏幕接近。
2. 湿度在 0-100% 范围内。
3. 照度会随遮挡或室内灯变化。
4. PM1、PM2.5、PM10 的量级和大小关系合理。
5. 等待下一轮上报，确认实体不是只在启动时出现一次。

不同传感元件的采样周期和校准方式可能不同。短时间内与另一台仪表有小幅差异，并不
能单独证明 DP 映射错误。明显不合理时先保存原始 DP、设备屏幕和时间，不要直接修改
换算倍率。

## 5. 可选：发布到 Apple Home

不要把整个 `sensor` 域加入 HomeKit Bridge。只选择这只设备需要的传感器，避免把
系统监控、信号强度和其他诊断数据一起发布。

Home Assistant 的 HomeKit Bridge 支持温度、湿度、照度、PM2.5 和 PM10 传感器。
PM1 没有对应的标准 HomeKit 类型，保留在 HA 中查看即可。UI 管理的桥可在“设置 >
设备与服务 > HomeKit Bridge > 配置”中逐项加入实体。

Apple Home 会把 PM2.5 或 PM10 表示为空气质量配件，并可能把数值折算成“优、良、
一般”等等级。完整的六项原始数值仍以 Home Assistant 为准。

## 6. 回退

如果 Zigbee2MQTT 重启循环、converter 加载失败或读数明显错误：

1. 保存 Zigbee2MQTT 启动日志和最近的设备原始 DP。
2. 删除或移走 `mili_env_sensor.js`。
3. 重启 Zigbee2MQTT，确认其他设备恢复正常。
4. 探测器可暂时保留为 unsupported device，不需要重建 Zigbee 网络。
5. 需要恢复原厂体系时，再按原厂流程把这一只设备重新加入原网关。

回退 converter 不会删除 Zigbee 网络中的其他设备。
