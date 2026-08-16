# 玄关3键开关和情景4件开关以及环境探测器

这个教程会增加如下三个设备
1. 玄关3合一开关，走廊射灯、离家模式、回家模式
2. 客厅4合一开关，会客、就寝、影音、就餐
3. 环境探测器，包括温度、湿度、照度、PM1.0、PM2.5、PM10

配置这三个设备，默认你已经通过之前的教程，配置过其他的开关

## 玄关3合一开关

1. Zigbee2MQTT Web界面，点击允许加入
2. 长按开关左上角，直到开关灯闪烁
3. Zigbee2MQTT Web界面可以看到新增加的设备，型号是TS0601和制造商_TZE200_0ahutzw0
4. 可以将该设备改名为玄关三键开关，这个时候在暴露功能中，看不到对一个的开关按键
5. 将external_converters中的mili_3gang_switch.js上传到docker/zigbee2mqtt的data/external_converters目录中
6. 重新启动zigbee2mqtt容器，并在日志中检查，如果显示 info: z2m: Loaded external converter 'mili_3gang_switch.js'.说明驱动加载成功。
7. 这个时候在暴露功能中就可以看到一个开关和一个Action，可以尝试这个开关和走廊射灯能否联动，同时按离家模式和回家模式可以看看Action中显示什么，应该是可以显示center和right
8. 在HA的脚本中，添加一个回家模式脚本（设置-自动化与场景-脚本，创建脚本），取名回家模式，然后YAML编辑，将下面的配置粘贴进去，并保存，这个脚本我设置的是打开走廊射灯、客厅氛围灯、客厅吸顶灯，可以根据自己的需要来配置，离家模式也是类似的配置，根据自己的需要设置action

``` YAML
sequence:
  - action: switch.turn_on
    metadata: {}
    target:
      entity_id: switch.xuan_guan_san_jian_kai_guan
    data: {}
    alias: 开灯
  - action: switch.turn_on
    metadata: {}
    target:
      entity_id: switch.ke_ting_san_jian_kai_guan_right
    data: {}
  - action: switch.turn_on
    metadata: {}
    target:
      entity_id: switch.ke_ting_san_jian_kai_guan_center
    data: {}
alias: 回家模式
description: 回家打开走廊射灯
icon: mdi:home-import-outline
```

9. 在HA的自动化，创建自动化（设置-自动化与场景-自动化，创建自动化），取名玄关中键底层拦截回家，然后YAML编辑，将下面的配置粘贴进去，并保存，这个自动化会监听玄关三键开关的center，中间按键，当监听到action是center的时候，会触发启动上面的回家模式脚本，离家模式类似，根据需要自己配置执行的脚本

``` YAML
alias: 玄关中键底层拦截回家
description: ""
triggers:
  - trigger: mqtt
    options:
      topic: zigbee2mqtt/玄关三键开关
      payload: center
      value_template: "{{ value_json.action }}"
conditions: []
actions:
  - action: script.turn_on
    metadata: {}
    target:
      entity_id: script.unknown_2 #这个unknow开头的实体id我怎么修改都改不成功，没办法，比较丑陋
    data: {}
mode: single
```
