# AGENTS.md

本目录是可公开分享的米立墙壁开关与 PR5Y 空调接入 Zigbee2MQTT、Home Assistant
和 Apple Home 的教程与适配包。Agent 开始工作前必须先读 `README.md`、
`HUMAN-GUIDE.md`、`docs/MILI-SWITCH.md`、`docs/PROTOCOL.md` 和用户自己的
`config.json`。

## 支持边界

- PR5Y converter 只支持已确认指纹 `TS0603` / `_TZF200_wkmsnr09` / `rpk52nw5`。
- 普通三路开关 `TS0003` / `_TZ3000_juccdfpb` 使用 Zigbee2MQTT 原生支持，不得套用 PR5Y converter。
- 只操作用户自己拥有、可物理复位、可恢复原厂网关的设备。
- 不扫描、加入、干扰或控制陌生 Zigbee 网络。
- 不猜测未确认 DP，不把相似 Tuya 产品的数据点直接套到 PR5Y。
- 不修改空调强电接线或未知控制总线。

## 隐私边界

- 不把真实 IEEE、IP、MAC、SSID、密钥、房间名或家庭成员名称写回发布模板。
- `config.json` 和 `build/` 可能含用户现场信息，公开打包时必须排除。
- 不读取或提交 Home Assistant `.storage`。
- 不读取或提交 Zigbee2MQTT 的 `network_key`、`pan_id`、`ext_pan_id`、
  `database.db`。
- 日志交付前删除其他 Zigbee 设备、主机名、IP 和账号信息。

## 标准流程

1. 检查设备指纹，不一致则停止自动部署。
2. 复制 `config.example.json` 为 `config.json`，只在本地填写。
3. 运行 `node tools/generate-config.mjs config.json build`。
4. 运行 `tools/test-kit.sh`。
5. 备份用户当前 Zigbee2MQTT 和 HA 配置。
6. 结构化合并 `build/zigbee2mqtt-device.yaml`，不得整份覆盖配置。
7. 安装生成的 converter，重启 Zigbee2MQTT 并确认稳定。
8. 执行 REGISTER、QUERY，核对三级地址。
9. 结构化合并 HA MQTT Climate，先检查配置再重启。
10. 先做只读验收，再对一个非关键区域做单变量主动测试。
11. Apple Home 只发布 Climate，不发布 raw/config/diagnostic 实体。

## 不能自动做的事情

- 不能在没有现场人员确认时快速启停空调或切换制冷/制热。
- 不能自动删除旧 Zigbee 网络、旧网关记录或 HA HomeKit Bridge。
- 不能为了修复一个设备重建整个 Zigbee 网络或删除 HA `.storage`。
- 不能把温度步进改成 0.5，也不能把温度乘 10 下发。
- 不能把节能、自动模式或六档风速伪造为已支持能力。

## 代码约束

- `external_converters/mili-hvac-pr5y.template.js` 中的 generated markers 必须保留。
- 设备列表由生成器替换，key 必须符合 `^[a-z][a-z0-9_]*$`。
- DP1/DP4 必须分消息发送。
- 跨模式安全顺序必须保留 2000 ms 关机等待和 500 ms 模式等待。
- 局部 DP 状态必须合并，不能把未上报字段清空。
- 温度必须是 16-30 的整数。

## 完成标准

- 生成器拒绝 placeholder IEEE、重复地址、重复 key 和 0.5 温度步进。
- 生成 converter 通过 `node --check`。
- 所有生成 YAML 可被 YAML parser 加载。
- `manifest.json` 中每个 SHA-256 与文件一致。
- 发布包隐私扫描不含现场数据。
- 主动测试后设备恢复到测试前状态。
