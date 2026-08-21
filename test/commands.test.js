import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ALL_COMMANDS, SCHEDULE_COMMAND } from '../src/commands.js';

describe('Discord command definitions', () => {
  it('places all required options before optional options', () => {
    for (const command of ALL_COMMANDS) {
      let sawOptional = false;
      for (const option of command.options ?? []) {
        if (!option.required) sawOptional = true;
        assert.equal(
          Boolean(sawOptional && option.required),
          false,
          `${command.name}.${option.name} is required after an optional option`,
        );
      }
    }
  });

  it('keeps the required schedule zone between time and activity', () => {
    assert.deepEqual(SCHEDULE_COMMAND.options.map(({ name, required }) => ({ name, required })), [
      { name: 'time', required: true },
      { name: 'zone', required: true },
      { name: 'activity', required: true },
    ]);
  });
});
