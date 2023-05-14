import { useSession } from "next-auth/react";
import { ChangeEvent, useCallback, useState } from "react";

import { fetcher } from "@/pages/_app";
import { Button, CheckboxInput, TextInput } from "@/components/core";
import ErrorComponent from "./_error";

export default function Test() {
    const [apiRequest, setApiRequestInner] = useState("");
    const [placeholders, setPlaceholders] = useState<string[]>([]);
    const [values, setValues] = useState<{ [key: string]: string | undefined }>({});
    const [sendAsUser, setSendAsUser] = useState(false);
    const [response, setResponse] = useState<any>(undefined);

    const setApiRequest = useCallback((value: string) => {
        setApiRequestInner(value);

        const placeholders = value.match(/{[^}]*}/g);
        setPlaceholders(placeholders ?? []);
    }, []);

    const onApiRequestChange = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
        const value = ev.currentTarget.value;
        setApiRequest(value);
    }, [setApiRequest]);

    const onPlaceholderChange = useCallback((placeholder: string, ev: ChangeEvent<HTMLInputElement>) => {
        const value = ev.currentTarget.value;
        setValues(values => ({
            ...values,
            [placeholder]: value,
        }))
    }, []);

    const onSendAsUserChange = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
        setSendAsUser(ev.currentTarget.checked);
    }, []);

    const { data: session } = useSession();
    if (!session || session.role !== "admin") {
        return <ErrorComponent statusCode={401} />;
    }

    const readyToSend = apiRequest.length > 0 && placeholders.every(placeholder => values[placeholder]);

    const sendRequest = async () => {
        if (!readyToSend) {
            return;
        }

        setResponse(undefined);

        let pathname = apiRequest;
        for (const placeholder of placeholders) {
            pathname = pathname.replaceAll(placeholder, values[placeholder] ?? "");
        }

        try {
            const response = await fetcher("/api/test", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    sendAsUser,
                    pathname,
                }),
            });

            setResponse(response.response);
        } catch (e: any) {
            setResponse(e.info);
        }
    };

    return <div className="flex flex-col w-full max-w-xl mx-auto space-y-3">
        <TextInput label="API Request" value={apiRequest} onChange={onApiRequestChange} />
        {placeholders.map(placeholder => <TextInput
            key={placeholder}
            label={placeholder}
            value={values[placeholder] ?? ""}
            onChange={onPlaceholderChange.bind(null, placeholder)}
        />)}
        <CheckboxInput
            label="Send as User"
            checked={sendAsUser} onChange={onSendAsUserChange}
            help="Send request as the logged in user instead of the bot."
        />
        <Button intent="primary" disabled={!readyToSend} onClick={sendRequest}>Send</Button>
        <pre className="mt-4 max-h-96 overflow-auto">
            {JSON.stringify(response, null, 2)}
        </pre>
        <ul className="mt-4 list-disc ps-6 pt-2 border-t">
            <li className="underline cursor-pointer" onClick={() => setApiRequest("/webhooks/{webhook.id}")}>
                Get Webhook
            </li>
            <li className="underline cursor-pointer" onClick={() => setApiRequest("/channels/{channel.id}")}>
                Get Channel
            </li>
            <li className="underline cursor-pointer" onClick={() => setApiRequest("/guilds/{guild.id}/members/{user.id}")}>
                Get Guild Member
            </li>
        </ul>
    </div>
}
