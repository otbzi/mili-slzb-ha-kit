import {onOff} from 'zigbee-herdsman-converters/lib/modernExtend';

export default [
  {
    zigbeeModel: ['REPLACE_WITH_ZIGBEE_MODEL_FROM_LOG'],
    model: 'REPLACE_WITH_MILI_MODEL',
    vendor: 'Mili',
    description: 'Mili wall switch probe definition',
    extend: [onOff()],
  },
];
