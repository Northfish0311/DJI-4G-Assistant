const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { readAppSource } = require("./helpers/app-source");
const source = readAppSource();
const state = {activeEid: "eid-1"};
const context = vm.createContext({state});
vm.runInContext(source.slice(source.indexOf("function profileViewKey("), source.indexOf("function renderProfileItems(")), context);
const profiles = [
  {iccid: "890001", profileNickname: "Travel", profileName: "Data", serviceProviderName: "Example EU", profileState: "enabled"},
  {iccid: "890002", profileName: "Bootstrap", profileState: "disabled"},
  {isdpAid: "A00001", profileName: '<script>alert("x")</script>', profileState: "disabled"},
];

test("profile search matches every literal term across name, provider and identifiers", () => {
  assert.equal(context.filterProfiles(profiles, {query: "  travel EU  ", status: "all"})[0], profiles[0]);
  assert.equal(context.filterProfiles(profiles, {query: "890002", status: "all"})[0], profiles[1]);
  assert.equal(context.filterProfiles(profiles, {query: "a00001", status: "all"})[0], profiles[2]);
  assert.equal(context.filterProfiles(profiles, {query: "[.*]", status: "all"}).length, 0);
  assert.equal(context.filterProfiles(profiles, {query: "<script>", status: "all"})[0], profiles[2]);
});

test("profile state filters do not treat an unknown state as disabled", () => {
  assert.equal(context.filterProfiles([...profiles, {}], {query: "", status: "all"}).length, 4);
  assert.equal(context.filterProfiles([...profiles, {}], {query: "", status: "disabled"}).length, 2);
  assert.equal(context.filterProfiles(profiles, {query: "travel", status: "disabled"}).length, 0);
  assert.equal(profiles[0].profileState, "enabled");
});

test("profile draft keys separate identical ICCIDs in different EID spaces", () => {
  state.activeEid = "eid-1";
  const first = context.profileViewKey("890001");
  state.activeEid = "eid-2";
  assert.notEqual(context.profileViewKey("890001"), first);
  assert.deepEqual(JSON.parse(first), ["eid-1", "890001"]);
});
