#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const toolDir = dirname(fileURLToPath(import.meta.url));
const kitRoot = resolve(toolDir, '..');
const configPath = resolve(process.argv[2] ?? join(kitRoot, 'config.json'));
const outputDir = resolve(process.argv[3] ?? join(kitRoot, 'build'));

function fail(message) {
  throw new Error(`Configuration error: ${message}`);
}

function yamlString(value) {
  return JSON.stringify(String(value));
}

function assertObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${field} must be an object`);
  }
}

function validateConfig(config) {
  assertObject(config, 'root');
  assertObject(config.device, 'device');
  assertObject(config.mqtt, 'mqtt');
  assertObject(config.homeAssistant, 'homeAssistant');

  if (config.schemaVersion !== 1) {
    fail('schemaVersion must be 1');
  }
  if (!/^0x[0-9a-f]{16}$/i.test(config.device.ieeeAddress ?? '')) {
    fail('device.ieeeAddress must look like 0x00124b0000000001');
  }
  if (!/^[A-Za-z0-9_-]+$/.test(config.device.friendlyName ?? '')) {
    fail('device.friendlyName may contain only ASCII letters, numbers, hyphens, and underscores');
  }
  if (!/^[a-z0-9_]+$/.test(config.homeAssistant.entityPrefix ?? '')) {
    fail('homeAssistant.entityPrefix must contain only lowercase letters, numbers, and underscores');
  }
  if (
    typeof config.mqtt.baseTopic !== 'string' ||
    !config.mqtt.baseTopic ||
    /[+#]/.test(config.mqtt.baseTopic)
  ) {
    fail('mqtt.baseTopic must be a concrete MQTT topic');
  }
  if (
    typeof config.mqtt.bridgeStateTopic !== 'string' ||
    !config.mqtt.bridgeStateTopic ||
    /[+#]/.test(config.mqtt.bridgeStateTopic)
  ) {
    fail('mqtt.bridgeStateTopic must be a concrete MQTT topic');
  }

  const minimum = Number(config.homeAssistant.temperatureMin);
  const maximum = Number(config.homeAssistant.temperatureMax);
  const step = Number(config.homeAssistant.temperatureStep);
  if (
    !Number.isInteger(minimum) ||
    !Number.isInteger(maximum) ||
    minimum < 16 ||
    maximum > 30 ||
    minimum >= maximum
  ) {
    fail('temperature range must use increasing integers within 16-30');
  }
  if (step !== 1) {
    fail('temperatureStep must be 1 because the verified PR5Y DP uses integer degrees');
  }
  if (
    config.homeAssistant.dashboardTitle !== undefined &&
    (typeof config.homeAssistant.dashboardTitle !== 'string' ||
      !config.homeAssistant.dashboardTitle.trim())
  ) {
    fail('homeAssistant.dashboardTitle must be a non-empty string');
  }
  if (!Array.isArray(config.zones) || config.zones.length < 1 || config.zones.length > 16) {
    fail('zones must contain between 1 and 16 entries');
  }

  const addresses = new Set();
  const keys = new Set();
  for (const [index, zone] of config.zones.entries()) {
    assertObject(zone, `zones[${index}]`);
    if (!/^0x[0-9a-f]{4}$/i.test(zone.address ?? '')) {
      fail(`zones[${index}].address must look like 0x0101`);
    }
    if (!/^[a-z][a-z0-9_]*$/.test(zone.key ?? '')) {
      fail(`zones[${index}].key must be a lowercase identifier`);
    }
    if (typeof zone.name !== 'string' || !zone.name.trim()) {
      fail(`zones[${index}].name must be non-empty`);
    }
    if (addresses.has(zone.address.toLowerCase())) {
      fail(`duplicate zone address: ${zone.address}`);
    }
    if (keys.has(zone.key)) {
      fail(`duplicate zone key: ${zone.key}`);
    }
    addresses.add(zone.address.toLowerCase());
    keys.add(zone.key);
  }
}

function zoneAddressParts(address) {
  const value = Number.parseInt(address.slice(2), 16);
  return {
    address: address.toLowerCase(),
    addressHigh: value >> 8,
    addressLow: value & 0xff,
  };
}

function generateConverter(template, zones) {
  const entries = zones.map((zone) => {
    const {address, addressHigh, addressLow} = zoneAddressParts(zone.address);
    return (
      `  {address: '${address}', addressHigh: 0x${addressHigh
        .toString(16)
        .padStart(2, '0')}, addressLow: 0x${addressLow
        .toString(16)
        .padStart(2, '0')}, key: '${zone.key}'},`
    );
  });
  const generatedBlock = [
    '// BEGIN GENERATED TERTIARY DEVICES',
    'const tertiaryDevices = [',
    ...entries,
    '];',
    '// END GENERATED TERTIARY DEVICES',
  ].join('\n');
  const marker =
    /\/\/ BEGIN GENERATED TERTIARY DEVICES[\s\S]*?\/\/ END GENERATED TERTIARY DEVICES/;
  if (!marker.test(template)) {
    throw new Error('Converter template is missing the generated-device markers');
  }
  return template.replace(marker, generatedBlock);
}

function climateYaml(config) {
  const topic = `${config.mqtt.baseTopic}/${config.device.friendlyName}`;
  const prefix = config.homeAssistant.entityPrefix;
  const parent = `zigbee2mqtt_${config.device.ieeeAddress.toLowerCase()}`;
  const climates = config.zones.map((zone) => {
    const entityKey = `${prefix}_${zone.key}`;
    return `    - name: null
      default_entity_id: climate.${entityKey}
      unique_id: ${entityKey}
      availability:
        - topic: ${yamlString(config.mqtt.bridgeStateTopic)}
          value_template: "{{ value_json.state }}"
      mode_command_topic: ${yamlString(`${topic}/set/${zone.key}_hvac_mode`)}
      mode_state_topic: ${yamlString(topic)}
      mode_state_template: >-
        {% set power = value_json.${zone.key}_power | default(none) %}
        {% set mode = value_json.${zone.key}_mode_raw | default(-1) | int(-1) %}
        {{ 'None' if power is none else ('off' if power == 'OFF' else
          {0: 'cool', 1: 'heat', 2: 'dry', 3: 'fan_only'}.get(mode, 'None')) }}
      modes:
        - "off"
        - "cool"
        - "heat"
        - "dry"
        - "fan_only"
      temperature_command_topic: ${yamlString(`${topic}/set/${zone.key}_target_temperature`)}
      temperature_state_topic: ${yamlString(topic)}
      temperature_state_template: "{{ value_json.${zone.key}_target_temperature | default('None', true) }}"
      current_temperature_topic: ${yamlString(topic)}
      current_temperature_template: "{{ value_json.${zone.key}_local_temperature | default('None', true) }}"
      fan_mode_command_topic: ${yamlString(`${topic}/set/${zone.key}_fan_mode`)}
      fan_mode_state_topic: ${yamlString(topic)}
      fan_mode_state_template: >-
        {% set fan = value_json.${zone.key}_fan_raw | default(-1) | int(-1) %}
        {{ {0: 'low', 1: 'medium', 2: 'high'}.get(fan, 'None') }}
      fan_modes:
        - "low"
        - "medium"
        - "high"
      min_temp: ${config.homeAssistant.temperatureMin}
      max_temp: ${config.homeAssistant.temperatureMax}
      temp_step: 1
      precision: 1
      optimistic: false
      retain: false
      device:
        identifiers:
          - ${entityKey}
        name: ${yamlString(zone.name)}
        manufacturer: "Mili / Tuya"
        model: "PR5Y tertiary AC"
        via_device: ${parent}`;
  });
  return `- climate:\n${climates.join('\n\n')}\n`;
}

function packageYaml(config) {
  const prefix = config.homeAssistant.entityPrefix;
  const zoneData = config.zones.map((zone) => ({
    ...zone,
    climate: `climate.${prefix}_${zone.key}`,
    timer: `timer.${prefix}_${zone.key}_delayed_off`,
    timerKey: `${prefix}_${zone.key}_delayed_off`,
  }));
  const timers = zoneData
    .map(
      (zone) => `  ${zone.timerKey}:
    name: ${yamlString(`${zone.name}延时关闭`)}
    duration: "01:00:00"
    restore: true`,
    )
    .join('\n');
  const options = zoneData
    .map(
      (zone) => `              - label: ${yamlString(zone.name)}
                value: ${yamlString(zone.climate)}`,
    )
    .join('\n');
  const timerByClimate = zoneData
    .map((zone) => `            ${zone.climate}: ${zone.timer}`)
    .join('\n');
  const allowedTimers = zoneData.map((zone) => `            '${zone.timer}'`).join(',\n');
  const climateByTimer = zoneData
    .map((zone) => `            ${zone.timer}: ${zone.climate}`)
    .join('\n');

  return `timer:
${timers}

script:
  ${prefix}_schedule_delayed_off:
    alias: "空调延时关闭"
    description: "选择一台 PR5Y 空调并设置延时关闭分钟数"
    mode: restart
    fields:
      air_conditioner:
        name: "空调"
        required: true
        selector:
          select:
            options:
${options}
      minutes:
        name: "分钟"
        required: true
        default: 60
        selector:
          number:
            min: 1
            max: 720
            step: 1
            unit_of_measurement: "min"
            mode: box
    sequence:
      - variables:
          timer_by_climate:
${timerByClimate}
          selected_timer: "{{ timer_by_climate.get(air_conditioner) }}"
      - condition: template
        value_template: "{{ selected_timer is not none }}"
      - action: timer.start
        target:
          entity_id: "{{ selected_timer }}"
        data:
          duration: "{{ (minutes | int(60)) * 60 }}"

  ${prefix}_cancel_delayed_off:
    alias: "取消空调延时关闭"
    description: "取消所选 PR5Y 空调的延时关闭"
    mode: parallel
    fields:
      air_conditioner:
        name: "空调"
        required: true
        selector:
          select:
            options:
${options}
    sequence:
      - variables:
          timer_by_climate:
${timerByClimate}
          selected_timer: "{{ timer_by_climate.get(air_conditioner) }}"
      - condition: template
        value_template: "{{ selected_timer is not none }}"
      - action: timer.cancel
        target:
          entity_id: "{{ selected_timer }}"

automation:
  - id: ${prefix}_delayed_off_finished
    alias: "PR5Y 空调延时关闭执行"
    mode: queued
    trigger:
      - platform: event
        event_type: timer.finished
    condition:
      - condition: template
        value_template: >-
          {{ trigger.event.data.entity_id in [
${allowedTimers}
          ] }}
    action:
      - variables:
          climate_by_timer:
${climateByTimer}
          selected_climate: "{{ climate_by_timer.get(trigger.event.data.entity_id) }}"
      - action: climate.turn_off
        target:
          entity_id: "{{ selected_climate }}"
`;
}

function dashboardYaml(config) {
  const prefix = config.homeAssistant.entityPrefix;
  const title = config.homeAssistant.dashboardTitle || '空调定时';
  const sections = config.zones
    .map((zone) => {
      const climate = `climate.${prefix}_${zone.key}`;
      const timer = `timer.${prefix}_${zone.key}_delayed_off`;
      const schedule = `script.${prefix}_schedule_delayed_off`;
      const cancel = `script.${prefix}_cancel_delayed_off`;
      const buttons = [
        [30, '30 分钟'],
        [60, '1 小时'],
        [120, '2 小时'],
      ]
        .map(
          ([minutes, name]) => `          - type: button
            name: ${yamlString(name)}
            icon: mdi:timer-sand
            tap_action:
              action: perform-action
              perform_action: ${schedule}
              data:
                air_conditioner: ${climate}
                minutes: ${minutes}`,
        )
        .join('\n');
      return `      - type: grid
        title: ${yamlString(zone.name)}
        cards:
          - type: tile
            entity: ${climate}
          - type: tile
            entity: ${timer}
${buttons}
          - type: button
            name: "取消"
            icon: mdi:timer-cancel-outline
            tap_action:
              action: perform-action
              perform_action: ${cancel}
              data:
                air_conditioner: ${climate}`;
    })
    .join('\n\n');
  return `title: ${yamlString(title)}
views:
  - title: ${yamlString(title)}
    path: timers
    icon: mdi:timer-outline
    type: sections
    max_columns: 2
    sections:
${sections}
`;
}

function homeKitFragment(config) {
  const prefix = config.homeAssistant.entityPrefix;
  const entities = config.zones
    .map((zone) => `    - climate.${prefix}_${zone.key}`)
    .join('\n');
  return `# This is a filter fragment, not a complete Home Assistant configuration.
# Prefer adding only these Climate entities to a UI-managed HomeKit Bridge.
filter:
  include_entities:
${entities}
`;
}

function z2mDeviceSnippet(config) {
  return `devices:
  ${yamlString(config.device.ieeeAddress.toLowerCase())}:
    friendly_name: ${yamlString(config.device.friendlyName)}
    retain: true
`;
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function main() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  validateConfig(config);
  const templatePath = join(kitRoot, 'external_converters', 'mili-hvac-pr5y.template.js');
  const template = await readFile(templatePath, 'utf8');
  const files = {
    'mili-hvac-pr5y.js': generateConverter(template, config.zones),
    'home-assistant-mqtt.yaml': climateYaml(config),
    'home-assistant-package.yaml': packageYaml(config),
    'home-assistant-dashboard.yaml': dashboardYaml(config),
    'homekit-filter-fragment.yaml': homeKitFragment(config),
    'zigbee2mqtt-device.yaml': z2mDeviceSnippet(config),
  };

  await mkdir(outputDir, {recursive: true});
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(outputDir, name), content);
  }
  const manifest = {
    package: 'mili-pr5y-ha-kit',
    schemaVersion: 1,
    supportedFingerprint: {
      modelID: 'TS0603',
      manufacturerName: '_TZF200_wkmsnr09',
      productIdentifier: 'rpk52nw5',
    },
    device: {
      ieeeAddress: config.device.ieeeAddress.toLowerCase(),
      friendlyName: config.device.friendlyName,
    },
    zones: config.zones,
    files: Object.fromEntries(
      Object.entries(files).map(([name, content]) => [name, {sha256: sha256(content)}]),
    ),
  };
  await writeFile(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`Generated ${Object.keys(files).length} files in ${outputDir}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
