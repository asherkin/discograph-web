import { Head, Html, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body className="text-black bg-slate-100 dark:text-white dark:bg-slate-800">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
