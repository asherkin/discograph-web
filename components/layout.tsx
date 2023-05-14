import { signIn, signOut, useSession } from "next-auth/react";
import { Inter } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { PropsWithChildren } from "react";

import { Button } from "@/components/core";
import logoImage from "@/public/logo.svg";

const inter = Inter({ subsets: ['latin'] });

interface UserInfoProps {
    signInToDashboard: boolean,
    signOutToIndex: boolean,
}

function UserInfo({ signInToDashboard, signOutToIndex }: UserInfoProps) {
    const { data: session, status } = useSession();

    if (status === "loading") {
        return <span />
    }

    if (status !== "authenticated") {
        return <Button onClick={() => signIn(undefined, { callbackUrl: signInToDashboard ? "/servers" : undefined })}>Login with Discord</Button>;
    }

    return <div className={`flex items-center ${signInToDashboard ? "" : "max-sm:hidden"}`}>
        <span className={signInToDashboard ? "" : "max-md:hidden"}>
            {/*{session?.user?.image && <Image src={session.user.image} width={40} height={40} alt=""*/}
            {/*                                className="inline border border-slate-200 dark:border-slate-600 mr-3 rounded-lg" />}*/}
            {session?.user?.name}
        </span>
        <Button className="ml-3" onClick={() => signOut({ callbackUrl: signOutToIndex ? "/" : undefined })}>Logout</Button>
    </div>;
}

interface LayoutProps {
    showHeaderLogo: boolean,
    signOutToIndex: boolean,
}

export default function Layout({ showHeaderLogo, signOutToIndex, children }: PropsWithChildren<LayoutProps>) {
    return <div className={`p-9 min-h-screen flex flex-col justify-stretch ${inter.className}`}>
        <header className="flex justify-between mb-9 h-11">
            {showHeaderLogo ? <Link href="/" className="text-4xl font-semibold flex items-center h-11">
                <Image width={40} height={40} className="rounded-lg mr-3" src={logoImage} alt="" priority />
                DiscoGraph
            </Link> : <span />}
            <UserInfo signInToDashboard={!showHeaderLogo} signOutToIndex={signOutToIndex} />
        </header>
        <main className="flex flex-col flex-grow">{children}</main>
        <footer className={`mt-6 opacity-40 ${showHeaderLogo ? "text-right" : "text-left"}`}>
            <Link href="/terms" className="hover:text-indigo-900 dark:hover:text-indigo-200">Terms of Service</Link>
            {" "}&middot;{" "}
            <Link href="/privacy" className="hover:text-indigo-900 dark:hover:text-indigo-200">Privacy Policy</Link>
        </footer>
    </div>;
}