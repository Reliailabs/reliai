"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { User, Bell, Lock, Palette, Users, Zap, ChevronRight, Server, Building2, BarChart3, Boxes, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SettingsSurfaceData } from "@/components/dashboard/pulse-types";

const defaultSettingsSections = [
  {
    id: "appearance",
    label: "Appearance",
    description: "Customize dashboard layout and theme behavior",
    icon: Palette,
    href: "/settings#appearance",
  },
  {
    id: "integrations",
    label: "Integrations",
    description: "Connect incident, alerting, and workflow tools",
    icon: Zap,
    href: "/settings#integrations",
  },
  {
    id: "security",
    label: "Security",
    description: "Control authentication and access settings",
    icon: Lock,
    href: "/settings#security",
  },
  {
    id: "profile",
    label: "Profile",
    description: "Manage your personal information",
    icon: User,
    href: "/settings#profile",
  },
  {
    id: "notifications",
    label: "Notifications",
    description: "Configure how you receive updates",
    icon: Bell,
    href: "/settings#notifications",
  },
  {
    id: "team",
    label: "Team",
    description: "Manage team members and roles",
    icon: Users,
    href: "/settings#team",
  },
];

const iconById = {
  appearance: Palette,
  integrations: Zap,
  security: Lock,
  profile: User,
  notifications: Bell,
  team: Users,
  project: Building2,
  organization: Building2,
  members: Users,
  alerts: Bell,
  services: Boxes,
  pipeline: Server,
  extensions: Server,
  customers: Users,
  growth: BarChart3,
  expansion: BarChart3,
  platform: Server,
  reliability: Building2,
  intelligence: Building2,
} as const;

const defaultIntegrations = [
  { name: "PagerDuty", connected: true, icon: "PD", statusLabel: "Connected" },
  { name: "Slack", connected: true, icon: "S", statusLabel: "Connected" },
  { name: "Datadog", connected: true, icon: "DD", statusLabel: "Connected" },
  { name: "GitHub", connected: true, icon: "GH", statusLabel: "Connected" },
  { name: "Jira", connected: false, icon: "J", statusLabel: "Planned" },
];

const statusCopy = {
  mapped: "Mapped",
  partial: "Partial",
  stub: "Planned",
} as const;

export function SettingsContent({ settingsData }: { settingsData?: SettingsSurfaceData }) {
  const settingsSections = settingsData?.quickItems?.length
    ? settingsData.quickItems
    : defaultSettingsSections.map((section) => ({ ...section, status: "mapped" as const }));
  const integrations = settingsData?.integrations?.length ? settingsData.integrations : defaultIntegrations;
  const profile = settingsData?.profile ?? {
    initials: "JD",
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@company.com",
    role: "SRE Lead",
  };
  const sourceErrorText =
    settingsData && settingsData.sourceErrors.length > 0
      ? `Data source unavailable: ${settingsData.sourceErrors.join(", ")}.`
      : null;

  return (
    <div className="max-w-4xl space-y-6">
      {sourceErrorText ? (
        <div className="rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          {sourceErrorText}
        </div>
      ) : null}
      {/* Profile Section */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Profile Settings</h3>
        
        <div className="flex items-start gap-6">
          <div className="w-20 h-20 rounded-2xl bg-chart-1/10 text-chart-1 flex items-center justify-center text-2xl font-semibold">
            {profile.initials}
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-2">First Name</label>
                <input
                  type="text"
                  id="firstName"
                  defaultValue={profile.firstName}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-2">Last Name</label>
                <input
                  type="text"
                  id="lastName"
                  defaultValue={profile.lastName}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">Email</label>
                <input
                  type="email"
                  id="email"
                  defaultValue={profile.email}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="col-span-2">
                <label htmlFor="role" className="block text-sm font-medium text-foreground mb-2">Role</label>
                <input
                  type="text"
                  id="role"
                  defaultValue={profile.role}
                  className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button>Save Changes</Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Settings */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <h3 className="font-semibold text-foreground p-6 pb-4">Quick Settings</h3>
        <p className="px-6 pb-4 text-xs text-muted-foreground">
          Some controls are staged for upcoming parity slices and are marked as Planned or Partial.
        </p>
        <div className="divide-y divide-border">
          {settingsSections.map((section) => {
            const Icon = ("icon" in section && section.icon ? section.icon : iconById[section.id as keyof typeof iconById]) ?? Settings;
            const href = "href" in section && section.href ? section.href : "/settings";
            return (
              <Link
                key={section.id}
                href={href}
                className="w-full flex items-center gap-4 p-6 hover:bg-muted/30 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground text-sm">{section.label}</p>
                    {"status" in section ? (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        section.status === "mapped"
                          ? "bg-success/10 text-success"
                          : section.status === "partial"
                            ? "bg-warning/10 text-warning"
                            : "bg-muted text-muted-foreground"
                      )}>
                        {statusCopy[section.status]}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">{section.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Integrations */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <h3 className="font-semibold text-foreground mb-6">Integrations</h3>
        <div className="space-y-3">
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center gap-4 p-4 rounded-xl bg-muted/30"
            >
              <div className="w-10 h-10 rounded-xl bg-foreground/10 flex items-center justify-center text-sm font-semibold text-foreground">
                {integration.icon}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">{integration.name}</p>
                <p className="text-xs text-muted-foreground">{integration.statusLabel ?? (integration.connected ? "Connected" : "Not connected")}</p>
              </div>
              <Button
                variant={integration.connected ? "outline" : "default"}
                size="sm"
                className={cn(integration.connected && "bg-transparent")}
              >
                {integration.connected ? "Connected" : "Planned"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
