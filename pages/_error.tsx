import { NextPage } from "next";
import Head from "next/head";

const statusCodes: { [code: number]: string } = {
    400: 'Bad Request',
    404: 'This page could not be found',
    405: 'Method Not Allowed',
    500: 'Internal Server Error',
}

interface ErrorProps {
    statusCode: number | undefined,
}

const Error: NextPage<ErrorProps> = ({ statusCode }) => {
    const title = statusCodes[statusCode ?? 500] || "An unexpected error has occurred";

    return <div className="flex-grow flex items-center justify-center p-6">
        <Head>
            <title>
                {statusCode
                    ? `${statusCode}: ${title}`
                    : 'Application error: a client-side exception has occurred'}
            </title>
        </Head>
        {statusCode ? (
            <h2 className="font-semibold pe-3 me-3 border-slate-500 border-e-2">
                {statusCode}
            </h2>
        ) : null}
        <h2>
            {statusCode ? (
                title
            ) : (
                <>
                    Application error: a client-side exception has occurred
                    (see the browser console for more information)
                </>
            )}
            .
        </h2>
    </div>;
};

Error.getInitialProps = ({ res, err }) => {
    const statusCode = res ? res.statusCode : err ? err.statusCode : 404;

    return { statusCode };
};

export default Error;
