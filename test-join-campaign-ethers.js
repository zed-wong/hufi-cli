#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const forwardedArgs = [
  path.join(__dirname, 'join-campaign-api.js'),
  '--generate-wallet',
  '--show-private-key',
  '--json',
  ...args,
];

const child = spawnSync(process.execPath, forwardedArgs, {
  stdio: 'inherit',
});

process.exit(child.status ?? 1);
