import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import Head from "next/head";
import { SWRConfig } from "swr";

import Layout from "@/components/layout";
import "@/styles/globals.css";

export async function fetcher<T = any>(...args: Parameters<typeof fetch>): Promise<T> {
  const res = await fetch(...args);

  if (!res.ok) {
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
        <meta key="description" name="description" content="A Discord Bot that infers relationships between users and draws pretty graphs." />
        <meta property="og:title" content="DiscoGraph" />
        <meta property="og:description" content="A Discord Bot that infers relationships between users and draws pretty graphs." />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={(new URL('/logo-256.png', baseUrl)).href} />
        <meta property="og:image:width" content="256" />
        <meta property="og:image:height" content="256" />
        <meta property="og:url" content={baseUrl} />
      </Head>
      <Layout showHeaderLogo={pathname !== '/'} signOutToIndex={!!pathname.match("^/server(/|s?$)")}>
        <Component {...pageProps} />
      </Layout>
    </SWRConfig>
  </SessionProvider>;
}
