# PR5Y 协议说明

本文只描述已经通过真实设备回报和控制闭环确认的部分。未确认字段保持未知，不用
相似 Tuya 产品的含义进行猜测。

## 设备指纹

```text
modelID: TS0603
manufacturerName: _TZF200_wkmsnr09
product identifier: rpk52nw5
```

## 设备模型

PR5Y 是 Zigbee 集中器，不是多个独立 Zigbee 终端。它通过 Tuya 私有 cluster
`0xEF00` 代理多个内部空调区域。每个区域由两字节三级地址标识。

converter 为每个配置区域创建一组属性：

```text
<key>_power
<key>_target_temperature
<key>_local_temperature
<key>_hvac_mode
<key>_mode_raw
<key>_fan_mode
<key>_fan_raw
```

## 私有命令

| Command | 名称 | 方向 | 用途 |
| --- | --- | --- | --- |
| `0x30` | ADD_REQ | Zigbee2MQTT 到 PR5Y | 请求注册三级地址 |
| `0x31` | ADD_RSP | PR5Y 到 Zigbee2MQTT | 返回地址和产品标识 |
| `0x32` | ADD_CONF | Zigbee2MQTT 到 PR5Y | 确认绑定成功 |
| `0x35` | DATA_REQ | Zigbee2MQTT 到 PR5Y | 写入指定区域 DP |
| `0x36` | DATA_RSP | PR5Y 到 Zigbee2MQTT | 返回状态或执行结果 |
| `0x39` | DATA_SYNC | PR5Y 到 Zigbee2MQTT | 主动同步状态 |

标准 Tuya converter 不认识其中一部分命令。本 converter 注册自定义 cluster，
对收到的私有命令发送正常 ZCL success，并自行解析 raw payload。

## 已确认 DP

| DP | Tuya 类型 | 含义 | 编码 |
| --- | --- | --- | --- |
| 1 | bool `0x01` | 电源 | 0 = OFF，1 = ON |
| 2 | value `0x02` | 目标温度 | 16-30 的整数摄氏度 |
| 3 | value `0x02` | 当前室温 | 整数摄氏度 |
| 4 | enum `0x04` | HVAC 模式 | 0 冷，1 热，2 除湿，3 送风 |
| 5 | enum `0x04` | 风速 | 0 低，1 中，2 高 |

状态上报可能只含一个发生变化的 DP。converter 必须把局部 patch 合并到该三级地址
的内存快照，缺失字段不能覆盖已有状态。

## 下行数据

`DATA_REQ` 的 payload 包含三级设备低地址字节和一个或多个 Tuya DP record。当前
实现故意每次只发送一个 DP record。

原因是实测 PR5Y 在同一条三级消息中收到 DP4 模式与 DP1 开机时，只执行第一个
DP。非 off 模式采用：

```text
写 DP4 -> 等待设备处理 -> 单独写 DP1=ON
```

## 跨模式保护

日立墙面板在开机状态直接从制冷切到制热时，可能同时保留两个模式指示。当前算法：

```text
如果已关机:
  写目标 DP4
  写 DP1=ON

如果已开机且目标模式相同:
  写目标 DP4
  写 DP1=ON

如果已开机且目标模式不同:
  写 DP1=OFF
  等待 2000 ms
  写目标 DP4
  等待 500 ms
  写 DP1=ON
```

这个等待解决的是墙面板状态清除，不代表可以忽略空调厂家对压缩机启停的保护时间。

## 风速压缩

已观察到六档物理面板按两档一组映射：

| 物理位置 | DP5 | HA |
| --- | --- | --- |
| 1、2 | 0 | low |
| 3、4 | 1 | medium |
| 5、6 | 2 | high |

因此三档是协议粒度，不是 UI 遗漏。

## 温度限制

物理面板可能显示 0.5 摄氏度，但 DP2 上行只保留整数。把 27.5 乘 10 写为 275
不是有效编码，设备可能按低字节解释为完全不同的温度。

实现必须保持：

```text
整数输入
16 <= temperature <= 30
temperatureStep = 1
```

## 未实现能力

- `auto`：没有物理模式和已验证枚举
- 0.5 摄氏度：协议中不可区分
- 六个独立远程风速：只有三个 DP 值
- 节能：没有可重复、独立的上报或写入 DP
- 原厂云定时：改由 HA timer/automation 实现

## 调试字段

converter 暴露以下诊断值：

- `tertiary_device_address`
- `tertiary_device_addresses`
- `tertiary_device_pid`
- `tertiary_registration_confirm`
- `tertiary_status_address`
- `tertiary_status_snapshot`
- `tertiary_raw_command`
- `tertiary_raw_payload`
- `tertiary_dp_sequence`
- `tertiary_dp_values`

这些字段用于日志分析，不应进入 Apple Home，也不应作为家人日常控制入口。
