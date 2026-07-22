const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const logDir = path.join(root, '.runtime-logs');
fs.mkdirSync(logDir, { recursive: true });

const services = [
  {
    name: 'backend',
    cwd: root,
    command: process.execPath,
    args: [path.join(root, 'dist', 'main.js')],
  },
  {
    name: 'admin',
    cwd: path.join(root, 'admin-dashboard'),
    command: process.execPath,
    args: [path.join(root, 'admin-dashboard', 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', '3200'],
  },
  {
    name: 'storefront',
    cwd: path.join(root, 'nexio-storefront'),
    command: process.execPath,
    args: [path.join(root, 'nexio-storefront', 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', '8080'],
  },
];

const requestedServices = new Set(process.argv.slice(2));
const selectedServices = requestedServices.size
  ? services.filter((service) => requestedServices.has(service.name))
  : services;

if (selectedServices.length === 0) {
  throw new Error(`Unknown service. Available services: ${services.map((service) => service.name).join(', ')}`);
}

for (const service of selectedServices) {
  const output = fs.openSync(path.join(logDir, `${service.name}.out.log`), 'a');
  const error = fs.openSync(path.join(logDir, `${service.name}.err.log`), 'a');
  const child = spawn(service.command, service.args, {
    cwd: service.cwd,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', output, error],
  });
  child.unref();
  fs.writeFileSync(path.join(logDir, `${service.name}.pid`), String(child.pid));
  process.stdout.write(`${service.name}:${child.pid}\n`);
}
