#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { DEFAULT_CONTROL, execute } from './ledger.mjs';

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      control: { type: 'string', default: DEFAULT_CONTROL },
      actor: { type: 'string' },
      input: { type: 'string' },
      'request-id': { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help || positionals.length === 0) {
    process.stdout.write('node tools/studio/cli.mjs <command> --actor <identity> [--input file.json|-] [--control dir] [--request-id id]\nCommands: init, task add (or add), status, claim, renew, complete, review, integrate, verify, fail, pause, resume, recover, recover-lock, replan, controller-claim, controller-renew, controller-release\nSee tools/studio/README.md for JSON inputs and safety boundaries.\n');
  } else {
    const command = positionals[0] === 'task' && positionals[1] === 'add' ? 'add' : positionals[0];
    if (positionals.length !== (positionals[0] === 'task' ? 2 : 1)) throw new Error('Unexpected positional arguments');
    const input = values.input ? JSON.parse(readFileSync(values.input === '-' ? 0 : values.input, 'utf8').replace(/^\uFEFF/, '')) : {};
    const result = execute(values.control, command, input, { actor: values.actor, requestId: values['request-id'] });
    process.stdout.write(`${JSON.stringify({ ok: true, ...result }, null, 2)}\n`);
  }
} catch (error) {
  process.stderr.write(`${JSON.stringify({ ok: false, error: error.message })}\n`);
  process.exitCode = 1;
}
