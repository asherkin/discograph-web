import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { useSession } from "next-auth/react";
import Image from "next/image";

import { LinkButton } from "@/components/core";
import logoImage from "@/public/logo.svg";

export default function Home() {
  const { status } = useSession();

  return <div className="flex-grow flex flex-col items-center justify-center p-6">
    <Image width={128} height={128} className="rounded-xl dark:border dark:border-slate-500" src={logoImage} alt="" priority />
    <h1 className="text-6xl font-bold my-6">DiscoGraph</h1>
    <p className="mb-6 text-center">A Discord Bot that infers conversations between users and draws pretty graphs.</p>
    <div className="max-sm:flex max-sm:flex-wrap max-sm:space-y-3 sm:space-x-3">
      <LinkButton className="w-full" intent="primary" target="_blank" rel="noreferrer" href={{
        protocol: "https:",
        host: "discord.com",
        pathname: "/api/oauth2/authorize",
        query: {
          client_id: process.env.NEXT_PUBLIC_DISCORD_ID,
          scope: "bot applications.commands",
          permissions: "274878024768",
        },
      }}>
        Add to server <ArrowTopRightOnSquareIcon className="inline h-5 w-5 align-top ml-1" />
      </LinkButton>
      <LinkButton className="w-full" href="/servers">
        {status === "authenticated" ? "View your servers" : "Login with Discord"}
      </LinkButton>
    </div>
  </div>;
}
