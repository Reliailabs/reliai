import assert from "node:assert/strict";
import test from "node:test";

import { buildTeamInviteJoinHref, buildTeamInviteSignupHref } from "@/lib/team-invite-link";

test("team invite signup href encodes invite context canonically", () => {
  assert.equal(
    buildTeamInviteSignupHref("invitee@company.com"),
    "/signup?entry=team-invite&email=invitee%40company.com",
  );
});

test("team invite signup href trims email before encoding", () => {
  assert.equal(
    buildTeamInviteSignupHref("  invitee@company.com  "),
    "/signup?entry=team-invite&email=invitee%40company.com",
  );
});

test("team invite join href canonicalizes token path", () => {
  assert.equal(buildTeamInviteJoinHref("  abc123  "), "/join?token=abc123");
});
