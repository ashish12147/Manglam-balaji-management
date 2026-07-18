import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) throw new Error('Usage: node scripts/Check-Licenses.mjs <pnpm-licenses.json>');

const content = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
const report = JSON.parse(content);
const forbidden = /(^|\s|\()((A|SS)GPL)(-|\s|$)/i;
const findings = [];

const visit = (value, location = 'root') => {
  if (typeof value === 'string' && forbidden.test(value)) findings.push(`${location}: ${value}`);
  if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${location}[${index}]`));
  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      if (forbidden.test(key)) findings.push(`${location}: ${key}`);
      visit(item, `${location}.${key}`);
    });
  }
};

visit(report);
if (findings.length) {
  throw new Error(`Forbidden production dependency licenses found:\n${findings.join('\n')}`);
}
console.log('Production dependency license policy passed.');
