import * as exposes from 'zigbee-herdsman-converters/lib/exposes';
import * as tuya from 'zigbee-herdsman-converters/lib/tuya';

const e = exposes.presets;

export default [
  {
    fingerprint: tuya.fingerprint('TS0601', ['_TZE200_elpnedea']),
    model: 'MILI-TS0601-ENV-6IN1',
    vendor: 'Mili / Tuya',
    description: 'Six-in-one environment detector',
    fromZigbee: [tuya.fz.datapoints],
    toZigbee: [],
    configure: tuya.configureMagicPacket,
    exposes: [e.temperature(), e.humidity(), e.illuminance(), e.pm1(), e.pm25(), e.pm10()],
    meta: {
      tuyaDatapoints: [
        [2, 'pm25', tuya.valueConverter.raw],
        [17, 'illuminance', tuya.valueConverter.raw],
        [18, 'temperature', tuya.valueConverter.divideBy10],
        [19, 'humidity', tuya.valueConverter.raw],
        [23, 'pm1', tuya.valueConverter.raw],
        [24, 'pm10', tuya.valueConverter.raw],
      ],
    },
  },
];

