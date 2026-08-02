#!/usr/bin/env node

import process from 'node:process';

function clean(value) {
  return typeof value === 'string' ? value.trim().replace(/^['"]|['"]$/g, '') : '';
}

function readDotenv(input) {
  const values = {};
  for (const line of input.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = clean(match[2]);
  }
  return values;
}

async function environment() {
  if (!process.argv.includes('--stdin-dotenv')) return process.env;

  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  return readDotenv(input);
}

function decodeJwtPayload(value) {
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function validateUrl(value) {
  if (!value) return 'is missing';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
      return 'must use HTTPS outside local development';
    }
    return null;
  } catch {
    return 'is not a valid URL';
  }
}

function validateAnonKey(value) {
  if (!value) return 'is missing';
  if (value.startsWith('sb_secret_')) return 'contains a secret key instead of a browser-safe anon/publishable key';
  if (value.length < 20) return 'is unexpectedly short';

  const payload = decodeJwtPayload(value);
  if (payload?.role === 'service_role') {
    return 'contains a service-role key instead of the browser-safe anon key';
  }
  return null;
}

const env = await environment();
const checks = [
  ['VITE_SUPABASE_URL', validateUrl(clean(env.VITE_SUPABASE_URL))],
  ['VITE_SUPABASE_ANON_KEY', validateAnonKey(clean(env.VITE_SUPABASE_ANON_KEY))],
];
const failures = checks.filter(([, error]) => error);

if (failures.length > 0) {
  for (const [name, error] of failures) console.error(`[auth-env] ${name} ${error}.`);
  console.error('[auth-env] Supabase browser configuration is not ready for this build context.');
  process.exitCode = 1;
} else {
  console.log('[auth-env] Supabase URL and browser key are present and structurally valid.');
}
