const definition = {
    // 匹配你当前的型号和精细制造商 ID
    fingerprint: [{modelID: 'TS0601', manufacturerName: '_TZE200_elpnedea'}],
    model: 'TS0601_milih_6in1_env_detector',
    vendor: 'Tuya',
    description: 'Milih 6 in 1 Environment Detector (Temp, Hum, Lux, PM2.5, PM10, PM1.0)',
    
    options: [], 
    exposes: [
        // 1. 温度传感器卡片
        {type: 'numeric', name: 'temperature', property: 'temperature', access: 1, unit: '°C', description: 'Temperature'},
        // 2. 湿度传感器卡片
        {type: 'numeric', name: 'humidity', property: 'humidity', access: 1, unit: '%', description: 'Humidity'},
        // 3. 照度传感器卡片
        {type: 'numeric', name: 'illuminance', property: 'illuminance', access: 1, unit: 'lx', description: 'Illuminance'},
        // 4. PM2.5 传感器卡片
        {type: 'numeric', name: 'pm25', property: 'pm25', access: 1, unit: 'µg/m³', description: 'PM2.5'},
        // 5. PM10 传感器卡片
        {type: 'numeric', name: 'pm10', property: 'pm10', access: 1, unit: 'µg/m³', description: 'PM10'},
        // 6. PM1.0 传感器卡片
        {type: 'numeric', name: 'pm100', property: 'pm100', access: 1, unit: 'µg/m³', description: 'PM1.0'},
    ],
    
    fromZigbee: [{
        cluster: 'manuSpecificTuya',
        type: ['commandDataResponse', 'commandDataReport'],
        options: [], 
        convert: (model, msg, publish, options, meta) => {
            const dpValues = msg.data.dpValues;
            const result = {};
            
            for (const dpValue of dpValues) {
                const dp = dpValue.dp;
                
                // ️ 涂鸦标准多字节 Buffer 数据的最稳健兼容读取法
                let value = 0;
                if (Buffer.isBuffer(dpValue.data)) {
                    value = dpValue.data.readUInt32BE ? dpValue.data.readUInt32BE(0) : dpValue.data[0];
                } else if (Array.isArray(dpValue.data)) {
                    // 如果某些 Z2M 版本将其作为普通数组透传
                    value = (dpValue.data[0] << 24) | (dpValue.data[1] << 16) | (dpValue.data[2] << 8) | dpValue.data[3];
                } else {
                    value = dpValue.data;
                }
                
                switch (dp) {
                    case 18: // 温度 (227 / 10 = 22.7°C)
                        result.temperature = value / 10;
                        break;
                    case 19: // 湿度 (59%)
                        result.humidity = value;
                        break;
                    case 17: // 照度 (3 lx)
                        result.illuminance = value;
                        break;
                    case 2:  // PM2.5 (8 µg/m³)
                        result.pm25 = value;
                        break;
                    case 24: // PM10 (11 µg/m³)
                        result.pm10 = value;
                        break;
                    case 23: // PM1.0 (6 µg/m³)
                        result.pm100 = value;
                        break;
                }
            }
            return result;
        }
    }],

    toZigbee: [], 
    meta: {},
};

module.exports = definition;

