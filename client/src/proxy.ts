export { auth as proxy } from "@/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/groups/:path*",
    "/rooms/:path*",
    "/reports/:path*",
    "/packing/:path*",
    "/catalog/:path*",
    "/memberships/:path*",
    "/audit/:path*",
  ],
};
