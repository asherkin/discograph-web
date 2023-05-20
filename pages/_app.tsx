import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { SWRConfig } from "swr";

import Layout from "@/components/layout";
import "@/styles/globals.css";

export async function fetcher<T = any>(...args: Parameters<typeof fetch>): Promise<T> {
  const res = await fetch(...args);

  if (!res.ok) {
    // TODO: If the API call made a Discord request, and we got back a 401 from Discord, nuke their session.
    const error: Error & { info?: string, status?: number } = new Error("An error occurred while fetching the data.");
    error.info = await res.json();
    error.status = res.status;

    throw error;
  }

  return res.json();
}

export default function App({ Component, pageProps: { session, ...pageProps }, router: { pathname } }: AppProps) {
  const baseUrl = (typeof window !== "undefined") ? window.location.href : (process.env.NEXTAUTH_URL || "http://localhost:3000");

  return <SessionProvider session={session}>
    <SWRConfig value={{ fetcher }}>
      <Head>
        <title>DiscoGraph</title>
        <link rel="icon" type="image/x-icon" sizes="16x16 32x32 48x48" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="256x256" href="/favicon-256.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" type="image/png" sizes="256x256" href="/logo-256.png" />
        <meta key="description" name="description" content="A Discord Bot that infers conversations between users and draws pretty graphs." />
        <meta key="og-title" property="og:title" content="DiscoGraph" />
        <meta key="og-description" property="og:description" content="A Discord Bot that infers conversations between users and draws pretty graphs." />
        <meta key="og-type" property="og:type" content="website" />
        <meta key="og-image" property="og:image" content={(new URL('/logo-256.png', baseUrl)).href} />
        <meta key="og-image-width" property="og:image:width" content="256" />
        <meta key="og-image-height" property="og:image:height" content="256" />
        <meta key="og-url" property="og:url" content={baseUrl} />
      </Head>
      <Layout showHeaderLogo={pathname !== '/'} signOutToIndex={!!pathname.match("^/server(/|s?$)")}>
        <Component {...pageProps} />
      </Layout>
    </SWRConfig>
  </SessionProvider>;
}
