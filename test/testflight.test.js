const test = require('node:test');
const assert = require('node:assert/strict');
const {validate, validateProfile} = require('../scripts/ios/upload-testflight.cjs');
const team = 'ABCDEFGHIJ';
const env = {APPLE_TEAM_ID: team, APPLE_CERTIFICATE_P12_BASE64: 'YQ==', APPLE_CERTIFICATE_PASSWORD: '', APPLE_PROFILE_BASE64: 'YQ==', ASC_KEY_ID: '123ABC', ASC_ISSUER_ID: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', ASC_PRIVATE_KEY_BASE64: 'YQ==', BUILD_NUMBER: '3'};
const profile = {TeamIdentifier: [team], UUID: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', ExpirationDate: '2099-01-01T00:00:00Z', Entitlements: {'application-identifier': team + '.com.northfish0311.dji4gassistant', 'beta-reports-active': true}};
test('TestFlight requires credentials and an explicit valid build number', () => {
  assert.doesNotThrow(() => validate(env));
  for (const key of ['APPLE_TEAM_ID', 'APPLE_CERTIFICATE_P12_BASE64', 'APPLE_PROFILE_BASE64', 'ASC_KEY_ID', 'ASC_ISSUER_ID', 'ASC_PRIVATE_KEY_BASE64']) assert.throws(() => validate({...env, [key]: ''}));
  for (const number of ['0', '10000', '3;echo bad', '', '-1']) assert.throws(() => validate({...env, BUILD_NUMBER: number}));
});
test('TestFlight rejects mismatched, expired and non-store profiles', () => {
  assert.doesNotThrow(() => validateProfile(profile, team));
  for (const override of [{TeamIdentifier: ['OTHERTEAM1']}, {ExpirationDate: '2000-01-01'}, {ExpirationDate: 'invalid'}, {ProvisionedDevices: []}, {ProvisionsAllDevices: true}, {Entitlements: {...profile.Entitlements, 'get-task-allow': true}}, {Entitlements: {...profile.Entitlements, 'application-identifier': team + '.other'}}]) assert.throws(() => validateProfile({...profile, ...override}, team));
});
