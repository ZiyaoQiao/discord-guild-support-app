import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSupportLogMessage, createTicketId, extractModalValues, getOption } from '../src/support.js';

describe('support helpers', () => {
  it('creates stable ticket IDs from a timestamp', () => {
    assert.equal(createTicketId(new Date('2026-05-24T12:34:56.000Z')), 'WWM-20260524-RFFY8');
  });

  it('reads command option values with a fallback', () => {
    const options = [{ name: 'category', value: 'bug' }];
    assert.equal(getOption(options, 'category'), 'bug');
    assert.equal(getOption(options, 'urgency', 'normal'), 'normal');
  });

  it('extracts nested modal values', () => {
    const values = extractModalValues([
      {
        type: 1,
        components: [
          {
            custom_id: 'details',
            value: 'Quest is blocked after the cutscene.',
          },
        ],
      },
    ]);

    assert.deepEqual(values, {
      details: 'Quest is blocked after the cutscene.',
    });
  });

  it('builds support log messages without broad mention parsing', () => {
    const message = buildSupportLogMessage({
      id: 'WWM-1',
      categoryLabel: 'Bug or crash',
      urgencyLabel: 'High',
      userId: '123',
      username: 'tester',
      channelId: '456',
      details: '@everyone cannot finish quest',
    });

    assert.match(message.content, /WWM-1/);
    assert.match(message.content, /<@123>/);
    assert.match(message.content, /@everyone cannot finish quest/);
  });
});
