import { SessionProvider } from "next-auth/react";
import type { AppProps } from "next/app";
import Head from "next/head";

import Layout from "@/components/layout";
import "@/styles/globals.css";

export default function App({ Component, pageProps: { session, ...pageProps }, router: { pathname } }: AppProps) {
  const baseUrl = (typeof window !== "undefined") ? window.location.href : (process.env.NEXTAUTH_URL || "http://localhost:3000");

  return <SessionProvider session={session}>
    <Head>
      <title>DiscoGraph</title>
      <link rel="shortcut icon" href="/favicon.ico" />
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
  </SessionProvider>
}
