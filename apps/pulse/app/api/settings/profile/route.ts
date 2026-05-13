import { NextResponse } from "next/server";
import { getSettingsProfile } from "@/lib/settings-profile-repository";

export async function GET() {
  try {
    const data = await getSettingsProfile();
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        profile: {
          initials: "RO",
          firstName: "Reliai",
          lastName: "Operator",
          email: "operator@reliai.dev",
          role: "operator",
        },
        organization: { id: null },
        dataMode: "demo",
        sourceErrors: ["profile-route"],
      },
      { status: 500 },
    );
  }
}
