import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.join('manifest.json');
const versionsPath = path.join('versions.json');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const versions = JSON.parse(fs.readFileSync(versionsPath, 'utf8'));

versions[manifest.version] = manifest.minAppVersion;

fs.writeFileSync(versionsPath, JSON.stringify(versions, null, '\t') + '\n');
console.log(`Updated versions.json with ${manifest.version}: ${manifest.minAppVersion}`);