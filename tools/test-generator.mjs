#!/usr/bin/env node

import {execFile} from 'node:child_process';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

const execFileAsync = promisify(execFile);
const toolDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
const kitRoot = resolve(toolDir, '..');
const generator = join(toolDir, 'generate-config.mjs');
const example = JSON.parse(await readFile(join(kitRoot, 'config.example.json'), 'utf8'));
const workspace = await mkdtemp(join(tmpdir(), 'mili-pr5y-generator-test-'));

function validConfig() {
  return {
    ...structuredClone(example),
    device: {
      ...example.device,
      ieeeAddress: '0x00124b0000000001',
    },
  };
}

async function runCase(name, mutate, shouldPass, expectedMessage) {
  const config = validConfig();
  mutate(config);
  const configPath = join(workspace, `${name}.json`);
  const outputPath = join(workspace, `${name}-build`);
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`);
  try {
    await execFileAsync(process.execPath, [generator, configPath, outputPath]);
    if (!shouldPass) {
      throw new Error(`${name}: expected generation to fail`);
    }
    return outputPath;
  } catch (error) {
    if (shouldPass) {
      throw error;
    }
    const message = `${error.stderr ?? ''}${error.message ?? ''}`;
    if (!message.includes(expectedMessage)) {
      throw new Error(`${name}: missing expected error "${expectedMessage}"`);
    }
    return null;
  }
}

try {
  const validOutput = await runCase('valid', () => {}, true);
  const converter = await readFile(join(validOutput, 'mili-hvac-pr5y.js'), 'utf8');
  if (!converter.includes("key: 'zone_4'")) {
    throw new Error('valid: generated converter is missing zone_4');
  }

  await runCase(
    'placeholder-ieee',
    (config) => {
      config.device.ieeeAddress = 'REPLACE_WITH_DEVICE_IEEE';
    },
    false,
    'device.ieeeAddress',
  );
  await runCase(
    'duplicate-address',
    (config) => {
      config.zones[1].address = config.zones[0].address;
    },
    false,
    'duplicate zone address',
  );
  await runCase(
    'duplicate-key',
    (config) => {
      config.zones[1].key = config.zones[0].key;
    },
    false,
    'duplicate zone key',
  );
  await runCase(
    'half-degree',
    (config) => {
      config.homeAssistant.temperatureStep = 0.5;
    },
    false,
    'temperatureStep must be 1',
  );
  await runCase(
    'mqtt-wildcard',
    (config) => {
      config.device.friendlyName = 'mili/#';
    },
    false,
    'may contain only ASCII',
  );
  const twoZoneOutput = await runCase(
    'two-zones',
    (config) => {
      config.zones = config.zones.slice(0, 2);
    },
    true,
  );
  const twoZoneConverter = await readFile(join(twoZoneOutput, 'mili-hvac-pr5y.js'), 'utf8');
  if (twoZoneConverter.includes("key: 'zone_3'")) {
    throw new Error('two-zones: generated converter retained an unconfigured zone');
  }
  const highAddressOutput = await runCase(
    'high-address-byte',
    (config) => {
      config.zones = [
        {
          address: '0x0201',
          key: 'zone_a',
          name: '区域 A 空调',
        },
      ];
    },
    true,
  );
  const highAddressConverter = await readFile(
    join(highAddressOutput, 'mili-hvac-pr5y.js'),
    'utf8',
  );
  if (
    !highAddressConverter.includes('addressHigh: 0x02') ||
    !highAddressConverter.includes(
      '{data: [0x00, 0x00, 0x01, addressHigh, addressLow, ...data]}',
    )
  ) {
    throw new Error('high-address-byte: converter does not preserve the full address');
  }

  process.stdout.write('Generator tests passed: 8 cases.\n');
} finally {
  await rm(workspace, {recursive: true, force: true});
}
