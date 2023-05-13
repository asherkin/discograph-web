import type { NextApiHandler } from "next";
import { getToken } from "next-auth/jwt";

import { makeDiscordRequestAsApp, makeDiscordRequestAsUser } from "@/lib/discord";

export interface TestResponse {
    response: object,
}

interface ErrorResponse {
    error: string,
}

const test: NextApiHandler<TestResponse | ErrorResponse> = async (req, res) => {
    const token = await getToken({ req });
    if (!token) {
        res.status(403).json({
            error: "not authenticated",
        });

        return;
    }

    if (token.role !== "admin") {
        res.status(401).json({
            error: "unauthorized",
        });

        return;
    }

    const { sendAsUser, pathname }: {
        sendAsUser: boolean,
        pathname: string,
    } = req.body;

    try {
        let response;
        if (sendAsUser) {
            response = await makeDiscordRequestAsUser<any>(token, pathname, pathname);
        } else {
            response = await makeDiscordRequestAsApp<any>(pathname, pathname);
        }

        res.status(200).json({
            response,
        });
    } catch (e: any) {
        res.status(500).json({
            error: e.message,
        });
    }
};

export default test;
