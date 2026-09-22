export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/dashboard/:path*", "/groups/:path*", "/rooms/:path*", "/reports/:path*", "/catalog/:path*", "/memberships/:path*", "/audit/:path*", "/transport/:path*", "/receiving/:path*"],
};
