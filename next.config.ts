import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@react-pdf/renderer", "@libsql/client", "exceljs"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
