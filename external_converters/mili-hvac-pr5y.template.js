import {Zcl} from 'zigbee-herdsman';
import * as exposes from 'zigbee-herdsman-converters/lib/exposes';
import * as modernExtend from 'zigbee-herdsman-converters/lib/modernExtend';

const e = exposes.presets;
const ea = exposes.access;
const registeredAddresses = new Set();
const tertiaryStatuses = new Map();
const tertiaryClusterName = 'miliTertiaryTuya';
// BEGIN GENERATED TERTIARY DEVICES
const tertiaryDevices = [
  {address: '0x0101', addressHigh: 0x01, addressLow: 0x01, key: 'zone_1'},
  {address: '0x0102', addressHigh: 0x01, addressLow: 0x02, key: 'zone_2'},
  {address: '0x0103', addressHigh: 0x01, addressLow: 0x03, key: 'zone_3'},
  {address: '0x0104', addressHigh: 0x01, addressLow: 0x04, key: 'zone_4'},
];
// END GENERATED TERTIARY DEVICES
const tertiaryDeviceByAddress = new Map(tertiaryDevices.map((device) => [device.address, device]));
const tertiaryDeviceByKey = new Map(tertiaryDevices.map((device) => [device.key, device]));
const fanModeByRaw = new Map([
  [0, 'low'],
  [1, 'medium'],
  [2, 'high'],
]);
const fanModeRaw = new Map([...fanModeByRaw].map(([raw, mode]) => [mode, raw]));
const hvacModeByRaw = new Map([
  [0, 'cool'],
  [1, 'heat'],
  [2, 'dry'],
  [3, 'fan_only'],
]);
const hvacModeRaw = new Map([...hvacModeByRaw].map(([raw, mode]) => [mode, raw]));
const modeChangeOffSettleMs = 2000;
const modeChangeCommandSettleMs = 500;
const tertiaryControlKeys = tertiaryDevices.flatMap(({key}) => [
  `${key}_power`,
  `${key}_hvac_mode`,
  `${key}_target_temperature`,
  `${key}_fan_mode`,
]);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function mergeTertiaryStatus(address, patch) {
  const status = {...(tertiaryStatuses.get(address) ?? {}), ...patch};
  tertiaryStatuses.set(address, status);
  return status;
}

const tertiaryCluster = modernExtend.deviceAddCustomCluster(tertiaryClusterName, {
  name: tertiaryClusterName,
  ID: 0xef00,
  attributes: {},
  commands: {
    tertiaryDeviceAddRequest: {
      name: 'tertiaryDeviceAddRequest',
      ID: 0x30,
      parameters: [
        {name: 'sequenceHigh', type: Zcl.DataType.UINT8},
        {name: 'sequenceLow', type: Zcl.DataType.UINT8},
        {name: 'deviceType', type: Zcl.DataType.UINT8},
        {name: 'addressHigh', type: Zcl.DataType.UINT8},
        {name: 'addressLow', type: Zcl.DataType.UINT8},
      ],
    },
    tertiaryDeviceAddConfirm: {
      name: 'tertiaryDeviceAddConfirm',
      ID: 0x32,
      parameters: [
        {name: 'sequenceHigh', type: Zcl.DataType.UINT8},
        {name: 'sequenceLow', type: Zcl.DataType.UINT8},
        {name: 'deviceType', type: Zcl.DataType.UINT8},
        {name: 'addressHigh', type: Zcl.DataType.UINT8},
        {name: 'addressLow', type: Zcl.DataType.UINT8},
        {name: 'bindResult', type: Zcl.DataType.UINT8},
      ],
    },
    tertiaryDataRequest: {
      name: 'tertiaryDataRequest',
      ID: 0x35,
      parameters: [{name: 'data', type: Zcl.BuffaloZclDataType.LIST_UINT8}],
    },
  },
  commandsResponse: {},
});

function encodeDpValues(dpValues) {
  return dpValues
    .map((value) => {
      const data = Buffer.from(value.data?.data ?? value.data ?? []);
      return `${value.dp}:${value.datatype}:${data.toString('hex')}`;
    })
    .join(',');
}

function decodeTertiaryDpValues(data) {
  const values = [];
  let offset = 8;

  while (offset + 4 <= data.length) {
    const dp = data[offset];
    const datatype = data[offset + 1];
    const length = data.readUInt16BE(offset + 2);
    const end = offset + 4 + length;
    if (end > data.length) {
      break;
    }

    const raw = data.subarray(offset + 4, end);
    let value = raw.toString('hex');
    if (datatype === 0x01 && raw.length === 1) {
      value = raw[0] === 1;
    } else if ([0x02, 0x05].includes(datatype) && raw.length <= 6) {
      value = raw.readUIntBE(0, raw.length);
    } else if (datatype === 0x03) {
      value = raw.toString('utf8');
    } else if (datatype === 0x04 && raw.length === 1) {
      value = raw[0];
    }

    values.push({dp, datatype, value, raw: raw.toString('hex')});
    offset = end;
  }

  return values;
}

function encodeTertiaryDpValue(dp, datatype, value) {
  let raw;
  if (datatype === 0x01) {
    raw = Buffer.from([value ? 0x01 : 0x00]);
  } else if (datatype === 0x02) {
    raw = Buffer.alloc(4);
    raw.writeUInt32BE(value);
  } else if (datatype === 0x04) {
    raw = Buffer.from([value]);
  } else {
    throw new Error(`Unsupported tertiary DP datatype: ${datatype}`);
  }

  return Buffer.from([dp, datatype, raw.length >> 8, raw.length & 0xff, ...raw]);
}

async function sendTertiaryDp(entity, addressHigh, addressLow, ...dpRecords) {
  const data = Buffer.concat(dpRecords);
  await entity.command(
    tertiaryClusterName,
    'tertiaryDataRequest',
    {data: [0x00, 0x00, 0x01, addressHigh, addressLow, ...data]},
    {disableDefaultResponse: false},
  );
}

const tertiaryDeviceRegister = {
  cluster: tertiaryClusterName,
  type: ['raw'],
  convert: async (model, msg) => {
    const data = Buffer.from(msg.data);
    if (data.length < 3 || data[0] !== 0x09) {
      return {};
    }

    // These commands are absent from the standard Tuya ZCL table. Mirror the
    // normal ZCL success response so the concentrator can continue its flow.
    await msg.endpoint.defaultResponse(
      data[2],
      Zcl.Status.SUCCESS,
      0xef00,
      data[1],
      {direction: Zcl.Direction.CLIENT_TO_SERVER},
    );

    const result = {
      tertiary_raw_command: `0x${data[2].toString(16).padStart(2, '0')}`,
      tertiary_raw_payload: data.subarray(3).toString('hex'),
    };
    if ([0x36, 0x39].includes(data[2]) && data.length >= 8) {
      const address = `0x${data[6].toString(16).padStart(2, '0')}${data[7]
        .toString(16)
        .padStart(2, '0')}`;
      const dpValues = decodeTertiaryDpValues(data);
      const statusPatch = Object.fromEntries(dpValues.map(({dp, value}) => [`dp${dp}`, value]));
      const status = mergeTertiaryStatus(address, statusPatch);
      const device = tertiaryDeviceByAddress.get(address);
      const deviceStatus = {};
      if (device && 'dp1' in statusPatch) {
        deviceStatus[`${device.key}_power`] = status.dp1 ? 'ON' : 'OFF';
      }
      if (device && 'dp2' in statusPatch) {
        deviceStatus[`${device.key}_target_temperature`] = status.dp2;
      }
      if (device && 'dp3' in statusPatch) {
        deviceStatus[`${device.key}_local_temperature`] = status.dp3;
      }
      if (device && 'dp4' in statusPatch) {
        deviceStatus[`${device.key}_mode_raw`] = status.dp4;
      }
      if (device && ('dp1' in statusPatch || 'dp4' in statusPatch)) {
        const hvacMode = status.dp1 === false ? 'off' : hvacModeByRaw.get(status.dp4);
        if (hvacMode) {
          deviceStatus[`${device.key}_hvac_mode`] = hvacMode;
        }
      }
      if (device && 'dp5' in statusPatch) {
        deviceStatus[`${device.key}_fan_raw`] = status.dp5;
        const fanMode = fanModeByRaw.get(status.dp5);
        if (fanMode) {
          deviceStatus[`${device.key}_fan_mode`] = fanMode;
        }
      }

      return {
        ...result,
        ...deviceStatus,
        tertiary_status_address: address,
        tertiary_dp_sequence: data.subarray(3, 5).toString('hex'),
        tertiary_dp_values: dpValues
          .map(({dp, datatype, raw}) => `${dp}:${datatype}:${raw}`)
          .join(','),
        tertiary_status_snapshot: JSON.stringify(Object.fromEntries(tertiaryStatuses)),
      };
    }

    if (data[2] !== 0x31 || data.length < 16) {
      return result;
    }

    const address = `0x${data[6].toString(16).padStart(2, '0')}${data[7]
      .toString(16)
      .padStart(2, '0')}`;
    const pid = data.subarray(8).toString('ascii').replace(/\0+$/, '');
    registeredAddresses.add(address);

    // Tuya's gateway SDK sends ADD_CONF (0x32) after cloud-side registration.
    // Its reliable sequence is initialized to 0x0000; the remaining bytes are
    // tertiary type, two-byte address, and a one-byte bind result.
    await msg.endpoint.command(
      tertiaryClusterName,
      'tertiaryDeviceAddConfirm',
      {
        sequenceHigh: 0x00,
        sequenceLow: 0x00,
        deviceType: data[5],
        addressHigh: data[6],
        addressLow: data[7],
        bindResult: 0x01,
      },
      {disableDefaultResponse: false},
    );

    return {
      ...result,
      tertiary_device_address: address,
      tertiary_device_addresses: [...registeredAddresses].sort().join(','),
      tertiary_device_pid: pid,
      tertiary_registration_confirm: `${address}:success`,
    };
  },
};

const tertiaryDeviceRegistration = {
  key: ['register_tertiary_devices'],
  convertSet: async (entity, key, value) => {
    if (value !== 'REGISTER') {
      throw new Error(`Unsupported registration action: ${value}`);
    }

    for (const {addressHigh, addressLow} of tertiaryDevices) {
      await entity.command(
        tertiaryClusterName,
        'tertiaryDeviceAddRequest',
        {
          sequenceHigh: 0x00,
          sequenceLow: 0x00,
          deviceType: 0x01,
          addressHigh,
          addressLow,
        },
        {disableDefaultResponse: false},
      );
      await entity.command(
        tertiaryClusterName,
        'tertiaryDeviceAddConfirm',
        {
          sequenceHigh: 0x00,
          sequenceLow: 0x00,
          deviceType: 0x01,
          addressHigh,
          addressLow,
          bindResult: 0x01,
        },
        {disableDefaultResponse: false},
      );
    }

    return {state: {register_tertiary_devices: value}};
  },
};

const tertiaryHvacControl = {
  key: tertiaryControlKeys,
  convertSet: async (entity, key, value) => {
    const suffix = ['_target_temperature', '_hvac_mode', '_fan_mode', '_power'].find((candidate) =>
      key.endsWith(candidate),
    );
    const device = suffix ? tertiaryDeviceByKey.get(key.slice(0, -suffix.length)) : undefined;
    if (!device) {
      throw new Error(`Unsupported tertiary HVAC property: ${key}`);
    }

    if (suffix === '_power') {
      const normalized = String(value).toUpperCase();
      if (!['ON', 'OFF'].includes(normalized)) {
        throw new Error(`Unsupported ${device.key} power value: ${value}`);
      }
      await sendTertiaryDp(
        entity,
        device.addressHigh,
        device.addressLow,
        encodeTertiaryDpValue(0x01, 0x01, normalized === 'ON'),
      );
      mergeTertiaryStatus(device.address, {dp1: normalized === 'ON'});
      return {state: {[key]: normalized}};
    }

    if (suffix === '_hvac_mode') {
      const requestedMode = String(value).toLowerCase();
      if (requestedMode === 'off') {
        await sendTertiaryDp(
          entity,
          device.addressHigh,
          device.addressLow,
          encodeTertiaryDpValue(0x01, 0x01, false),
        );
        mergeTertiaryStatus(device.address, {dp1: false});
        return {state: {[key]: requestedMode, [`${device.key}_power`]: 'OFF'}};
      }

      const requestedRaw = hvacModeRaw.get(requestedMode);
      if (requestedRaw === undefined) {
        throw new Error(`Unsupported ${device.key} HVAC mode: ${value}`);
      }
      const currentStatus = tertiaryStatuses.get(device.address);
      const raw = requestedRaw;
      const normalized = requestedMode;
      const shouldStopBeforeModeChange =
        currentStatus?.dp1 !== false && currentStatus?.dp4 !== raw;

      // Changing modes while powered can leave both old and new mode indicators
      // lit on Hitachi wall panels. Stop first and let the panel clear.
      if (shouldStopBeforeModeChange) {
        await sendTertiaryDp(
          entity,
          device.addressHigh,
          device.addressLow,
          encodeTertiaryDpValue(0x01, 0x01, false),
        );
        mergeTertiaryStatus(device.address, {dp1: false});
        await delay(modeChangeOffSettleMs);
      }

      // PR5Y accepts only the first DP when mode and power are sent in one
      // tertiary message. Send them separately and let the mode settle first.
      await sendTertiaryDp(
        entity,
        device.addressHigh,
        device.addressLow,
        encodeTertiaryDpValue(0x04, 0x04, raw),
      );
      mergeTertiaryStatus(device.address, {dp4: raw});
      if (shouldStopBeforeModeChange) {
        await delay(modeChangeCommandSettleMs);
      }
      await sendTertiaryDp(
        entity,
        device.addressHigh,
        device.addressLow,
        encodeTertiaryDpValue(0x01, 0x01, true),
      );
      mergeTertiaryStatus(device.address, {dp1: true});
      return {
        state: {
          [key]: normalized,
          [`${device.key}_mode_raw`]: raw,
          [`${device.key}_power`]: 'ON',
        },
      };
    }

    if (suffix === '_fan_mode') {
      const normalized = String(value).toLowerCase();
      const raw = fanModeRaw.get(normalized);
      if (raw === undefined) {
        throw new Error(`Unsupported ${device.key} fan mode: ${value}`);
      }
      await sendTertiaryDp(
        entity,
        device.addressHigh,
        device.addressLow,
        encodeTertiaryDpValue(0x05, 0x04, raw),
      );
      return {state: {[key]: normalized}};
    }

    const temperature = Number(value);
    if (!Number.isInteger(temperature) || temperature < 16 || temperature > 30) {
      throw new Error(
        `${device.key} target temperature must be an integer from 16 to 30: ${value}`,
      );
    }
    await sendTertiaryDp(
      entity,
      device.addressHigh,
      device.addressLow,
      encodeTertiaryDpValue(0x02, 0x02, temperature),
    );
    return {state: {[key]: temperature}};
  },
};

const tertiaryDpReport = {
  cluster: 'manuSpecificTuya',
  type: [
    'commandDataReport',
    'commandDataResponse',
    'commandActiveStatusReport',
    'commandActiveStatusReportAlt',
  ],
  convert: (model, msg) => ({
    tertiary_dp_sequence: String(msg.data.seq),
    tertiary_dp_values: encodeDpValues(msg.data.dpValues ?? []),
  }),
};

const tertiaryStatusQuery = {
  key: ['query_tertiary_status'],
  convertSet: async (entity, key, value) => {
    if (value !== 'QUERY') {
      throw new Error(`Unsupported query action: ${value}`);
    }

    // The Tuya three-tier module maps the standard private-cluster query to
    // the MCU-side "query all tertiary device states" command.
    await entity.command('manuSpecificTuya', 'dataQuery', {});
    return {state: {query_tertiary_status: value}};
  },
};

export default [
  {
    fingerprint: [{modelID: 'TS0603', manufacturerName: '_TZF200_wkmsnr09'}],
    model: 'PR5Y',
    vendor: 'Mili / Tuya',
    description: 'Central air conditioner concentrator (experimental)',
    extend: [tertiaryCluster],
    fromZigbee: [tertiaryDeviceRegister, tertiaryDpReport],
    toZigbee: [tertiaryHvacControl, tertiaryDeviceRegistration, tertiaryStatusQuery],
    exposes: [
      ...tertiaryDevices.flatMap(({address, key}) => [
        e
          .binary(`${key}_power`, ea.STATE_SET, 'ON', 'OFF')
          .withDescription(`${address} air conditioner power`)
          .withCategory('config'),
        e
          .numeric(`${key}_target_temperature`, ea.STATE_SET)
          .withUnit('°C')
          .withValueMin(16)
          .withValueMax(30)
          .withValueStep(1)
          .withDescription(`${address} air conditioner target temperature`)
          .withCategory('config'),
        e
          .numeric(`${key}_local_temperature`, ea.STATE)
          .withUnit('°C')
          .withDescription(`${address} air conditioner room temperature`)
          .withCategory('diagnostic'),
        e
          .numeric(`${key}_mode_raw`, ea.STATE)
          .withDescription(`${address} air conditioner raw operating mode`)
          .withCategory('diagnostic'),
        e
          .enum(`${key}_hvac_mode`, ea.STATE_SET, ['off', 'cool', 'heat', 'dry', 'fan_only'])
          .withDescription(`${address} air conditioner HVAC mode`)
          .withCategory('config'),
        e
          .numeric(`${key}_fan_raw`, ea.STATE)
          .withDescription(`${address} air conditioner raw fan setting`)
          .withCategory('diagnostic'),
        e
          .enum(`${key}_fan_mode`, ea.STATE_SET, ['low', 'medium', 'high'])
          .withDescription(`${address} air conditioner fan speed`)
          .withCategory('config'),
      ]),
      e
        .enum('register_tertiary_devices', ea.SET, ['REGISTER'])
        .withDescription('Request registration of the configured internal air conditioners')
        .withCategory('config'),
      e
        .enum('query_tertiary_status', ea.SET, ['QUERY'])
        .withDescription('Request the current status of all internal air conditioners')
        .withCategory('config'),
      e
        .text('tertiary_device_address', ea.STATE)
        .withDescription('Most recently registered internal air conditioner address')
        .withCategory('diagnostic'),
      e
        .text('tertiary_device_addresses', ea.STATE)
        .withDescription('Internal air conditioner addresses registered in this session')
        .withCategory('diagnostic'),
      e
        .text('tertiary_device_pid', ea.STATE)
        .withDescription('Product identifier reported for the internal air conditioner')
        .withCategory('diagnostic'),
      e
        .text('tertiary_registration_confirm', ea.STATE)
        .withDescription('Most recent internal air conditioner registration confirmation')
        .withCategory('diagnostic'),
      e
        .text('tertiary_status_address', ea.STATE)
        .withDescription('Internal air conditioner address of the most recent status response')
        .withCategory('diagnostic'),
      e
        .text('tertiary_status_snapshot', ea.STATE)
        .withDescription('Decoded DP snapshot for all internal air conditioners')
        .withCategory('diagnostic'),
      e
        .text('tertiary_raw_command', ea.STATE)
        .withDescription('Most recently acknowledged private Tuya command')
        .withCategory('diagnostic'),
      e
        .text('tertiary_raw_payload', ea.STATE)
        .withDescription('Payload of the most recently acknowledged private Tuya command')
        .withCategory('diagnostic'),
      e
        .text('tertiary_dp_sequence', ea.STATE)
        .withDescription('Sequence number of the most recently received Tuya DP report')
        .withCategory('diagnostic'),
      e
        .text('tertiary_dp_values', ea.STATE)
        .withDescription('DP ID, type, and raw value from the most recent Tuya DP report')
        .withCategory('diagnostic'),
    ],
  },
];
