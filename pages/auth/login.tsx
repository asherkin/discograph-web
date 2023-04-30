import { GetServerSideProps } from "next";
import { getToken } from "next-auth/jwt";
import { signIn } from "next-auth/react";
import { useEffect } from "react";

import { Button } from "@/components/core";

interface SignInProps {
    callbackUrl: null | string,
    error: null | string,
}

export default function Login({ callbackUrl, error }: SignInProps) {
    useEffect(() => {
        if (!error) {
            signIn("discord");
        }
    }, [error]);

    if (!error) {
        return <div className="flex-grow flex flex-col items-center justify-center p-6">
            <p className="mb-6">Redirecting to Discord ...</p>
            <Button onClick={() => signIn("discord")}>Continue</Button>
        </div>;
    }

    return <div className="flex-grow flex flex-col items-center justify-center p-6">
        <p className="mb-6">An error occurred during login.</p>
        <Button onClick={() => signIn("discord", { callbackUrl: callbackUrl ?? undefined })}>Try Again</Button>
    </div>;
}

export const getServerSideProps: GetServerSideProps<SignInProps> = async (context) => {
    const callbackUrl = Array.isArray(context.query.callbackUrl) ? context.query.callbackUrl[0] : context.query.callbackUrl;
    const error = Array.isArray(context.query.error) ? context.query.error[0] : context.query.error;

    const token = await getToken({ req: context.req });
    if (token) {
        return {
            redirect: {
                permanent: false,
                destination: callbackUrl ?? "/servers",
            }
        }
    }

    return {
        props: {
            callbackUrl: callbackUrl ?? null,
            error: error ?? null,
        },
    };
};
