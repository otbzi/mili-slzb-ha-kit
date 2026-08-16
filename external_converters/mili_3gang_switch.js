const fz = require('zigbee2mqtt/converters/fromZigbee');
const tz = require('zigbee2mqtt/converters/toZigbee');
const exposes = require('zigbee2mqtt/lib/exposes');
const reporting = require('zigbee2mqtt/lib/reporting');
const extend = require('zigbee2mqtt/lib/extend');
const ota = require('zigbee2mqtt/lib/ota');
const tuya = require('zigbee2mqtt/lib/tuya');
const e = exposes.presets;
const ea = exposes.access;

const definition = {
    fingerprint: [
        {modelID: 'TS0601', manufacturerName: '_TZE200_0ahutzw0'}
    ],
    model: 'TS0601_milih_3gang', // 型号名称变更为 3键
    vendor: 'Tuya',
    description: '3 gang smart switch (Custom)',
    // 💡 核心修正：在“暴露”页面强行画出三个独立的物理开关按钮（l1, l2, l3）
    exposes: [
        e.switch().withEndpoint('l1'), 
        e.switch().withEndpoint('l2'),
        e.switch().withEndpoint('l3')
    ],
    fromZigbee: [tuya.fz.datapoints],
    toZigbee: [tuya.law.datapoints],
    meta: {
        // 💡 核心修正：绑定涂鸦芯片内部的 1、2、3 号物理 DP 通道
        tuyaDatapoints: [
            [1, 'state_l1', tuya.valueConverter.onOff],
            [2, 'state_l2', tuya.valueConverter.onOff],
            [3, 'state_l3', tuya.valueConverter.onOff],
        ],
    },
    endpoint: (device) => {
        return {'l1': 1, 'l2': 1, 'l3': 1};
    },
};

module.exports = definition;

