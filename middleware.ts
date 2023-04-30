// Note: The default middleware will return a Location: redirect using the URL from the request, which if behind a
//       reverse proxy will likely be localhost. If you're seeing bogus redirects when accessing a middleware-protected
//       route as the initial navigation, check the equivalent of your proxy's proxy_redirect config option.
export { default } from "next-auth/middleware";

export const config = {
    matcher: [
        "/servers",
        "/server/:path*",
    ],
};