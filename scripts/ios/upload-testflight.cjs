const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const bundle = 'com.northfish0311.dji4gassistant';

function validate(env) {
  for (const key of ['APPLE_TEAM_ID', 'APPLE_CERTIFICATE_P12_BASE64', 'APPLE_PROFILE_BASE64', 'ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY_BASE64']) {
    if (!env[key]?.trim()) throw Error('Missing secret: ' + key);
  }
  if (env.APPLE_CERTIFICATE_PASSWORD === undefined) throw Error('Missing certificate password setting');
  if (!/^[A-Z0-9]{10}$/.test(env.APPLE_TEAM_ID)) throw Error('Invalid Apple team ID');
  if (!/^[A-Z0-9]+$/.test(env.ASC_KEY_ID)) throw Error('Invalid API key ID');
  if (!/^[0-9a-f-]{36}$/i.test(env.ASC_ISSUER_ID)) throw Error('Invalid API issuer ID');
  if (!/^[1-9][0-9]{0,3}$/.test(env.BUILD_NUMBER || '')) throw Error('Build number must be 1..9999');
}

function validateProfile(profile, team, now = Date.now()) {
  if (profile.TeamIdentifier?.[0] !== team || profile.Entitlements?.['application-identifier'] !== team + '.' + bundle) throw Error('Profile does not match this team and app');
  if (!profile.UUID || !/^[0-9a-f-]{36}$/i.test(profile.UUID)) throw Error('Invalid profile UUID');
  if (!profile.ExpirationDate || !(Date.parse(profile.ExpirationDate) > now)) throw Error('Profile expired or has no valid expiry');
  if (profile.ProvisionedDevices || profile.ProvisionsAllDevices || profile.Entitlements?.['get-task-allow'] || profile.Entitlements?.['beta-reports-active'] !== true) throw Error('An App Store distribution profile is required');
}

function main() {
  validate(process.env);
  if (process.platform !== 'darwin') throw Error('Signing requires the macOS workflow, not Windows');
  const env = process.env;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dji-testflight-'));
  const keychain = path.join(dir, 'signing.keychain-db');
  let installedProfile;
  let originalKeychains;
  function run(command, args, options = {}) {
    try { return execFileSync(command, args, {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options}); }
    catch { throw Error(command + ' failed; sensitive command arguments and output have been withheld.'); }
  }
  function secretFile(name, encoded) {
    if (!/^[A-Za-z0-9+/=\s]+$/.test(encoded)) throw Error('Invalid base64 secret: ' + name);
    const file = path.join(dir, name);
    fs.writeFileSync(file, Buffer.from(encoded, 'base64'), {mode: 0o600});
    return file;
  }
  try {
    const cert = secretFile('certificate.p12', env.APPLE_CERTIFICATE_P12_BASE64);
    const profileFile = secretFile('profile.mobileprovision', env.APPLE_PROFILE_BASE64);
    const apiKey = secretFile('AuthKey_' + env.ASC_KEY_ID + '.p8', env.ASC_PRIVATE_KEY_BASE64);
    const profileXML = run('security', ['cms', '-D', '-i', profileFile]);
    const profile = JSON.parse(run('python3', ['-c', 'import sys,plistlib,json; p=plistlib.loads(sys.stdin.buffer.read()); keys=["TeamIdentifier","Entitlements","UUID","ExpirationDate","ProvisionedDevices","ProvisionsAllDevices"]; print(json.dumps({k:p[k] for k in keys if k in p},default=lambda v:v.isoformat()))'], {input: profileXML}));
    validateProfile(profile, env.APPLE_TEAM_ID);
    const profileDir = path.join(os.homedir(), 'Library/MobileDevice/Provisioning Profiles');
    fs.mkdirSync(profileDir, {recursive: true});
    const destination = path.join(profileDir, profile.UUID + '.mobileprovision');
    if (fs.existsSync(destination)) throw Error('Profile already exists; refusing to replace it');
    fs.copyFileSync(profileFile, destination);
    installedProfile = destination;
    const password = crypto.randomBytes(32).toString('hex');
    run('security', ['create-keychain', '-p', password, keychain]);
    run('security', ['set-keychain-settings', '-lut', '21600', keychain]);
    run('security', ['unlock-keychain', '-p', password, keychain]);
    run('security', ['import', cert, '-k', keychain, '-P', env.APPLE_CERTIFICATE_PASSWORD, '-T', '/usr/bin/codesign', '-T', '/usr/bin/security']);
    run('security', ['set-key-partition-list', '-S', 'apple-tool:,apple:', '-k', password, keychain]);
    originalKeychains = [...run('security', ['list-keychains', '-d', 'user']).matchAll(/"([^"]+)"/g)].map(match => match[1]);
    if (!originalKeychains.length) throw Error('Unable to preserve keychain search list');
    run('security', ['list-keychains', '-d', 'user', '-s', keychain, ...originalKeychains]);
    run('plutil', ['-replace', 'CFBundleVersion', '-string', env.BUILD_NUMBER, 'ios/DJI4GAssistant/Info.plist']);
    const archive = path.join(dir, 'Assistant.xcarchive');
    console.log('Archiving signed iOS app...');
    run('xcodebuild', ['-project', 'ios/DJI4GAssistant.xcodeproj', '-scheme', 'DJI4GAssistant', '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-archivePath', archive, 'DEVELOPMENT_TEAM=' + env.APPLE_TEAM_ID, 'CODE_SIGN_STYLE=Manual', 'CODE_SIGN_IDENTITY=Apple Distribution', 'PROVISIONING_PROFILE_SPECIFIER=' + profile.UUID, 'OTHER_CODE_SIGN_FLAGS=--keychain ' + keychain, 'archive'], {maxBuffer: 32 * 1024 * 1024});
    const options = {method: 'app-store-connect', destination: 'upload', teamID: env.APPLE_TEAM_ID, signingStyle: 'manual', signingCertificate: 'Apple Distribution', provisioningProfiles: {[bundle]: profile.UUID}, manageAppVersionAndBuildNumber: false, uploadSymbols: true};
    const optionsFile = path.join(dir, 'ExportOptions.plist');
    run('plutil', ['-convert', 'xml1', '-o', optionsFile, '-'], {input: JSON.stringify(options)});
    console.log('Uploading to App Store Connect...');
    run('xcodebuild', ['-exportArchive', '-archivePath', archive, '-exportPath', path.join(dir, 'export'), '-exportOptionsPlist', optionsFile, '-authenticationKeyPath', apiKey, '-authenticationKeyID', env.ASC_KEY_ID, '-authenticationKeyIssuerID', env.ASC_ISSUER_ID], {maxBuffer: 32 * 1024 * 1024});
    console.log('Upload completed. Apple processing and beta review are separate steps.');
  } finally {
    if (originalKeychains?.length) {
      try { run('security', ['list-keychains', '-d', 'user', '-s', ...originalKeychains]); } catch {}
    }
    try { run('security', ['delete-keychain', keychain]); } catch {}
    if (installedProfile) fs.rmSync(installedProfile, {force: true});
    fs.rmSync(dir, {recursive: true, force: true});
  }
}
module.exports = {validate, validateProfile};
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
