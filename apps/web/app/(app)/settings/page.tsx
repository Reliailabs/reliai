import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { BellRing, RadioTower, ShieldCheck, Slash } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  disableOrgAlertTarget,
  enableOrgAlertTarget,
  getOrganization,
  getOrgAlertTarget,
  testOrgAlertTarget,
  upsertOrgAlertTarget
} from "@/lib/api";
import { requireOperatorSession } from "@/lib/auth";

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireOperatorSession();
  const params = searchParams ? await searchParams : {};
  const organizations = await Promise.all(
    session.memberships.map(async (membership) => {
      const organization = await getOrganization(membership.organization_id).catch(() => null);
      return organization;
    })
  );
  const availableOrganizations = organizations.filter(
    (organization): organization is NonNullable<typeof organization> => organization !== null
  );
  const requestedOrganizationId =
    typeof params.organizationId === "string" ? params.organizationId : undefined;
  const selectedOrganization =
    availableOrganizations.find((organization) => organization.id === requestedOrganizationId) ??
    availableOrganizations[0] ??
    null;
  const currentTarget = selectedOrganization
    ? await getOrgAlertTarget(selectedOrganization.id).catch(() => null)
    : null;
  const testMessage =
    typeof params.testMessage === "string" ? decodeURIComponent(params.testMessage) : null;
  const testSuccess = params.testSuccess === "true";

  async function saveTargetAction(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organization_id") ?? "");
    const channelTarget = String(formData.get("channel_target") ?? "");
    const slackWebhookUrl = String(formData.get("slack_webhook_url") ?? "").trim();
    const isActive = formData.get("is_active") === "on";
    await upsertOrgAlertTarget(organizationId, {
      channel_target: channelTarget,
      ...(slackWebhookUrl ? { slack_webhook_url: slackWebhookUrl } : {}),
      is_active: isActive
    });
    revalidatePath("/settings");
    redirect(`/settings?organizationId=${encodeURIComponent(organizationId)}`);
  }

  async function enableTargetAction(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organization_id") ?? "");
    await enableOrgAlertTarget(organizationId);
    revalidatePath("/settings");
    redirect(`/settings?organizationId=${encodeURIComponent(organizationId)}`);
  }

  async function disableTargetAction(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organization_id") ?? "");
    await disableOrgAlertTarget(organizationId);
    revalidatePath("/settings");
    redirect(`/settings?organizationId=${encodeURIComponent(organizationId)}`);
  }

  async function testTargetAction(formData: FormData) {
    "use server";
    const organizationId = String(formData.get("organization_id") ?? "");
    const result = await testOrgAlertTarget(organizationId);
    revalidatePath("/settings");
    redirect(
      `/settings?organizationId=${encodeURIComponent(organizationId)}&testSuccess=${String(
        result.success
      )}&testMessage=${encodeURIComponent(result.detail)}`
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-[28px] border border-zinc-300 bg-white px-6 py-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-steel">Settings</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              Operator alert target settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-steel">
              Manage the org-level Slack destination used for deterministic incident alerts.
              Webhook secrets are never returned in full after write.
            </p>
          </div>
          {selectedOrganization ? (
            <div className="rounded-2xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-steel">
              Active org · {selectedOrganization.name}
            </div>
          ) : null}
        </div>
      </header>

      {availableOrganizations.length > 1 ? (
        <Card className="rounded-[24px] border-zinc-300 p-5">
          <form action="/settings" className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Organization</p>
              <p className="mt-1 text-sm text-steel">Switch the org context for Slack target management.</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                name="organizationId"
                defaultValue={selectedOrganization?.id}
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm text-ink"
              >
                {availableOrganizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.name}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline">
                Switch
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {testMessage ? (
        <Card
          className={`rounded-[24px] p-4 ${
            testSuccess ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
          }`}
        >
          <p className="text-sm font-medium text-ink">{testSuccess ? "Slack test succeeded" : "Slack test failed"}</p>
          <p className="mt-2 text-sm text-steel">{testMessage}</p>
        </Card>
      ) : null}

      {selectedOrganization ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_360px]">
          <Card className="rounded-[28px] border-zinc-300 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Slack target</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">
                  {currentTarget ? currentTarget.channel_target : "No target configured"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-steel">
                  Save one org-level Slack webhook. Leave the webhook field blank during update to keep
                  the existing secret unchanged.
                </p>
              </div>
              <BellRing className="h-5 w-5 text-steel" />
            </div>

            <form action={saveTargetAction} className="mt-6 space-y-4">
              <input type="hidden" name="organization_id" value={selectedOrganization.id} />
              <div className="grid gap-4 lg:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink">Target label</span>
                  <input
                    name="channel_target"
                    required
                    defaultValue={currentTarget?.channel_target ?? "org:primary-slack"}
                    className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-ink"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-ink">Webhook URL</span>
                  <input
                    name="slack_webhook_url"
                    type="url"
                    placeholder={currentTarget?.has_secret ? "Leave blank to keep current webhook" : "https://hooks.slack.com/..."}
                    className="h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-ink"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-ink">
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={currentTarget?.is_active ?? true}
                  className="h-4 w-4 rounded border-zinc-400"
                />
                Enable this org-level Slack target for incident alerts
              </label>

              <Button type="submit">Save target</Button>
            </form>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[28px] border-zinc-300 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-steel">Current state</p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                  <p className="text-sm font-medium text-ink">Delivery status</p>
                  <p className="mt-2 text-sm text-steel">
                    {currentTarget
                      ? currentTarget.is_active
                        ? "Enabled for incident delivery"
                        : "Configured but disabled"
                      : "No Slack target configured"}
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                  <p className="text-sm font-medium text-ink">Stored secret</p>
                  <p className="mt-2 text-sm text-steel">{currentTarget?.webhook_masked ?? "No webhook stored"}</p>
                </div>
              </div>
            </Card>

            {currentTarget ? (
              <Card className="rounded-[28px] border-zinc-300 p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-steel">Quick actions</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <form action={currentTarget.is_active ? disableTargetAction : enableTargetAction}>
                    <input type="hidden" name="organization_id" value={selectedOrganization.id} />
                    <Button variant={currentTarget.is_active ? "outline" : "default"}>
                      {currentTarget.is_active ? (
                        <>
                          <Slash className="mr-2 h-4 w-4" />
                          Disable target
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-4 w-4" />
                          Enable target
                        </>
                      )}
                    </Button>
                  </form>
                  <form action={testTargetAction}>
                    <input type="hidden" name="organization_id" value={selectedOrganization.id} />
                    <Button variant="subtle">
                      <RadioTower className="mr-2 h-4 w-4" />
                      Send test
                    </Button>
                  </form>
                </div>
              </Card>
            ) : null}
          </div>
        </div>
      ) : (
        <Card className="rounded-[28px] border-zinc-300 p-6">
          <p className="text-sm text-steel">No organization memberships were found for this operator.</p>
        </Card>
      )}
    </div>
  );
}
