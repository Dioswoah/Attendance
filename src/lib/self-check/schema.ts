import { z } from "zod"

export const SELF_CHECK_ENTITY_TYPES = [
    "AttendanceSummary",
    "Attendance",
    "LeaveRequest",
    "Leave",
    "AttendanceRequest",
    "User",
] as const

export const findingSchema = z.object({
    entityType: z.enum(SELF_CHECK_ENTITY_TYPES),
    entityId: z.string().describe("The id of the record with the issue"),
    userId: z.string().nullable().describe("The affected staff member's User id, if applicable, else null"),
    issueType: z.string().describe("Short machine-readable code, e.g. NULL_CLOCK_OUT, ORPHANED_SUMMARY_LINK"),
    description: z.string().describe("Human-readable explanation of the issue"),
    severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
})

export const findingsOutputSchema = z.object({
    findings: z.array(findingSchema),
})

export type Finding = z.infer<typeof findingSchema>
export type FindingsOutput = z.infer<typeof findingsOutputSchema>
