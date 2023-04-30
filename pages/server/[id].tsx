import { useRouter } from "next/router";

import { Button } from "@/components/core";

export default function Server() {
    const router = useRouter();
    const { id } = router.query;

    return <div className="flex-grow flex flex-col items-center justify-center p-6">
        <p className="mb-6">Coming Soon ...</p>
        <Button intent="primary" onClick={() => window.history.back()}>Go Back</Button>
    </div>;
}
