import { NextResponse } from "next/server";

import { getOperatorSession } from "@/lib/auth";

export async function GET() {
  const session = await getOperatorSession();
  if (!session) {
    return NextResponse.json({ session: null }, { status: 401 });
  }
  return NextResponse.json({
    session: {
      operator: session.operator,
      active_organization_id: session.active_organization_id ?? null,
    },
  });
}
