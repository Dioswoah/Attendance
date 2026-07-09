import { Runner, InMemorySessionService } from "@google/adk"
import { prisma } from "@/lib/prisma"
import { selfCheckAgent } from "./agent"
import { findingsOutputSchema } from "./schema"

process.env.GOOGLE_GENAI_USE_VERTEXAI = process.env.GOOGLE_GENAI_USE_VERTEXAI || "1"
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.VERTEX_PROJECT_ID || process.env.PROJECT_ID
process.env.GOOGLE_CLOUD_LOCATION = process.env.GOOGLE_CLOUD_LOCATION || "us-central1"

const sessionService = new InMemorySessionService()
const runner = new Runner({ appName: "self-check", agent: selfCheckAgent, sessionService })

function todayIso() {
    return new Date().toISOString().slice(0, 10)
}

async function runAgentForDate(date: string) {
    const events = runner.runEphemeral({
        userId: "system",
        newMessage: { role: "user", parts: [{ text: `Run a self-check for ${date}.` }] },
    })

    let structuredFindings: unknown
    for await (const event of events) {
        if (event.errorCode || event.errorMessage) {
            throw new Error(`Self-check agent error [${event.errorCode}]: ${event.errorMessage}`)
        }
        const delta = (event.actions?.stateDelta ?? {}) as Record<string, unknown>
        if (delta.structured_findings !== undefined) {
            structuredFindings = delta.structured_findings
        }
    }

    if (structuredFindings === undefined) {
        throw new Error("Self-check agent finished without producing structured output")
    }

    const parsed = findingsOutputSchema.safeParse(
        typeof structuredFindings === "string" ? JSON.parse(structuredFindings) : structuredFindings
    )
    if (!parsed.success) {
        throw new Error(`Self-check agent output failed schema validation: ${parsed.error.message}`)
    }

    return parsed.data.findings
}

export async function runSelfCheckForToday(triggeredById: string) {
    const scanDate = new Date()
    scanDate.setHours(0, 0, 0, 0)

    const run = await prisma.selfCheckRun.create({
        data: { triggeredById, scanDate, status: "RUNNING" },
    })

    try {
        const findings = await runAgentForDate(todayIso())

        if (findings.length > 0) {
            await prisma.selfCheckFinding.createMany({
                data: findings.map((f) => ({
                    runId: run.id,
                    scanDate,
                    entityType: f.entityType,
                    entityId: f.entityId,
                    userId: f.userId ?? undefined,
                    issueType: f.issueType,
                    description: f.description,
                    severity: f.severity,
                })),
            })
        }

        const completedRun = await prisma.selfCheckRun.update({
            where: { id: run.id },
            data: { status: "COMPLETED", completedAt: new Date(), findingsCount: findings.length },
        })

        await prisma.activityLog.create({
            data: {
                userId: triggeredById,
                action: "SELF_CHECK_RUN",
                entityType: "SelfCheckRun",
                entityId: run.id,
                details: { status: "COMPLETED", findingsCount: findings.length },
            },
        })

        return { run: completedRun, findings: await prisma.selfCheckFinding.findMany({ where: { runId: run.id } }) }
    } catch (error: any) {
        console.error("[SelfCheck] Run failed:", error)
        const failedRun = await prisma.selfCheckRun.update({
            where: { id: run.id },
            data: { status: "FAILED", completedAt: new Date(), errorMessage: error?.message ?? "Unknown error" },
        })

        await prisma.activityLog.create({
            data: {
                userId: triggeredById,
                action: "SELF_CHECK_RUN",
                entityType: "SelfCheckRun",
                entityId: run.id,
                details: { status: "FAILED", errorMessage: error?.message ?? "Unknown error" },
            },
        })

        return { run: failedRun, findings: [] }
    }
}
