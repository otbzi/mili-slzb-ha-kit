#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
KIT_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
CONFIG_PATH="${1:-$KIT_ROOT/config.json}"

if [ ! -f "$CONFIG_PATH" ]; then
  echo "Missing config: $CONFIG_PATH" >&2
  echo "Copy config.example.json to config.json and fill in the device IEEE." >&2
  exit 2
fi

if [ "$#" -ge 2 ]; then
  OUTPUT_DIR=$2
  mkdir -p "$OUTPUT_DIR"
  CLEAN_OUTPUT=0
else
  OUTPUT_DIR=$(mktemp -d "${TMPDIR:-/tmp}/mili-pr5y-ha-kit.XXXXXX")
  CLEAN_OUTPUT=1
fi

cleanup() {
  if [ "$CLEAN_OUTPUT" -eq 1 ]; then
    rm -rf "$OUTPUT_DIR"
  fi
}
trap cleanup EXIT HUP INT TERM

echo "[1/7] Check standalone converter syntax and mappings"
node --check "$KIT_ROOT/external_converters/mili_env_sensor.js"
grep -q "_TZE200_elpnedea" "$KIT_ROOT/external_converters/mili_env_sensor.js"
grep -q "toZigbee: \[\]" "$KIT_ROOT/external_converters/mili_env_sensor.js"
grep -q "\[2, 'pm25', tuya.valueConverter.raw\]" "$KIT_ROOT/external_converters/mili_env_sensor.js"
grep -q "\[17, 'illuminance', tuya.valueConverter.raw\]" "$KIT_ROOT/external_converters/mili_env_sensor.js"
grep -q "\[18, 'temperature', tuya.valueConverter.divideBy10\]" "$KIT_ROOT/external_converters/mili_env_sensor.js"
grep -q "\[19, 'humidity', tuya.valueConverter.raw\]" "$KIT_ROOT/external_converters/mili_env_sensor.js"
grep -q "\[23, 'pm1', tuya.valueConverter.raw\]" "$KIT_ROOT/external_converters/mili_env_sensor.js"
grep -q "\[24, 'pm10', tuya.valueConverter.raw\]" "$KIT_ROOT/external_converters/mili_env_sensor.js"

echo "[2/7] Test generator validation"
node "$SCRIPT_DIR/test-generator.mjs"

echo "[3/7] Generate configuration"
node "$SCRIPT_DIR/generate-config.mjs" "$CONFIG_PATH" "$OUTPUT_DIR"

echo "[4/7] Check generated converter syntax"
node --check "$OUTPUT_DIR/mili-hvac-pr5y.js"

echo "[5/7] Check generated manifest and SHA-256 values"
node -e '
  const crypto = require("node:crypto");
  const fs = require("node:fs");
  const path = require("node:path");
  const root = process.argv[1];
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  if (manifest.package !== "mili-pr5y-ha-kit" || manifest.schemaVersion !== 1) {
    throw new Error("Unexpected manifest identity");
  }
  for (const [name, entry] of Object.entries(manifest.files)) {
    const data = fs.readFileSync(path.join(root, name));
    const actual = crypto.createHash("sha256").update(data).digest("hex");
    if (actual !== entry.sha256) {
      throw new Error(`SHA-256 mismatch for ${name}`);
    }
  }
' "$OUTPUT_DIR"

echo "[6/7] Parse generated YAML"
if command -v ruby >/dev/null 2>&1; then
  ruby -e '
    require "yaml"
    ARGV.each { |file| YAML.load_file(file) }
  ' \
    "$OUTPUT_DIR/home-assistant-mqtt.yaml" \
    "$OUTPUT_DIR/home-assistant-package.yaml" \
    "$OUTPUT_DIR/home-assistant-dashboard.yaml" \
    "$OUTPUT_DIR/homekit-filter-fragment.yaml" \
    "$OUTPUT_DIR/zigbee2mqtt-device.yaml"
else
  echo "Ruby is unavailable; YAML parser check skipped." >&2
fi

echo "[7/7] Check required safety behavior"
grep -q "const modeChangeOffSettleMs = 2000;" "$OUTPUT_DIR/mili-hvac-pr5y.js"
grep -q "const modeChangeCommandSettleMs = 500;" "$OUTPUT_DIR/mili-hvac-pr5y.js"
grep -q "Number.isInteger(temperature)" "$OUTPUT_DIR/mili-hvac-pr5y.js"
grep -q "retain: true" "$OUTPUT_DIR/zigbee2mqtt-device.yaml"
grep -q "temp_step: 1" "$OUTPUT_DIR/home-assistant-mqtt.yaml"

echo "All package checks passed."
