import { NextResponse } from "next/server";
import { getSettingsProfile, updateSettingsProfile } from "@/lib/settings-profile-repository";

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


export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { firstName?: string; lastName?: string };
    const firstName = body.firstName?.trim();
    const lastName = body.lastName?.trim();

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "firstName and lastName are required" }, { status: 400 });
    }

    const data = await updateSettingsProfile({ firstName, lastName });
    return NextResponse.json(data, { status: 200 });
  } catch {
    return NextResponse.json({ error: "profile update failed" }, { status: 500 });
  }
}
