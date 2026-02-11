import { Db } from "@tide/shared";
import { recall } from "./recall.js";
import { processEntry } from "@tide/shared";


const db = new Db(
    process.env.DATABASE_URL || "postgres://tide:tide_dev_password@localhost:5432/tide_recall",
    process.env.NETWORK || "testnet",
);

const port = Number(process.env.PORT) || 3000;
console.log(`[api] Starting server on port ${port}...`);

Bun.serve({
    port,

    async fetch(req: Request) {
        const url = new URL(req.url);

        // POST /recall
        if (url.pathname === "/recall" && req.method === "POST") {
            try {
                const body = await req.json();
                if (!body.query) {
                    return Response.json({ error: "query is required" }, { status: 400 });
                }
                const results = await recall(db, body.query, {
                    memoryId: body.memory_id,
                    owner: body.owner,
                    limit: body.limit,
                });
                return Response.json({ results });
            } catch (error) {
                console.error("[api] Error recalling memories:", error);
                return Response.json({ error: "internal server error" }, { status: 500 });
            }
        }

        // POST /ingest
        if (url.pathname === "/ingest" && req.method === "POST") {
            try {
                const body = await req.json();
                if (!body.memory_id || !body.payload_text) {
                    return Response.json({ error: "memory_id and payload_text are required" }, { status: 400 });
                }
                const entryId = await db.insertEntry({
                    memoryId: body.memory_id,
                    entryIndex: body.entry_index ?? 0,
                    actor: body.actor ?? null,
                    key: null,
                    payload: Buffer.from(body.payload_text),
                    payloadText: body.payload_text,
                    txDigest: null,
                    epoch: null,
                    timestampMs: Date.now(),
                    version: 1,
                });
                await processEntry(db, body.memory_id, entryId, body.payload_text);
                return Response.json({ entry_id: entryId, status: "indexed" });
            } catch (error) {
                console.error("[api] Error ingesting memory:", error);
                return Response.json({ error: "internal server error" }, { status: 500 });
            }
        }

        // GET /memories/:objectId
        if (url.pathname.startsWith("/memories/") && req.method === "GET") {
            const objectId = url.pathname.split("/")[2];
            if (!objectId) {
                return Response.json({ error: "objectId required" }, { status: 400 });
            }
            const memory = await db.getMemoryWithEntries(objectId);
            if (!memory) {
                return Response.json({ error: "not found" }, { status: 404 });
            }
            return Response.json(memory);
        }

        // GET /health
        if (url.pathname === "/health") {
            return Response.json({ status: "ok" });
        }

        return Response.json({ error: "not found" }, { status: 404 });
    },
});