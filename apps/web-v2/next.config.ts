import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/incidents/:incidentId/command",
        destination: "/incidents/:incidentId",
        permanent: true,
      },
    ]
  },
}

export default nextConfig