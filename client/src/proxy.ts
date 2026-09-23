export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/welcome/:path*",
    "/groups/:path*",
    "/rooms/:path*",
    "/catalog/:path*",
    "/memberships/:path*",
    "/logistics/:path*",
    "/audit/:path*",
    "/packing/:path*",
    "/transport/:path*",
    "/receiving/:path*",
    "/pickup/:path*",
    "/package-status/:path*",
    "/scan-package/:path*",
  ],
};
