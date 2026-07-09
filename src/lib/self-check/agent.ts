import { LlmAgent } from "@google/adk"
import { selfCheckTools } from "./tools"
import { findingsOutputSchema } from "./schema"

// Mirrors src/lib/agent/config.ts's AGENT_CONFIG.location — same Vertex AI project/region as RISA.
// Model pinned to gemini-2.5-flash — confirmed available in this project's Model Garden via direct
// probe (gemini-2.0-flash and gemini-3-flash both 404'd; gemini-2.5-flash/pro returned 200).
export const SELF_CHECK_CONFIG = {
    modelName: "gemini-2.5-flash",
    location: "us-central1",
}

const INSTRUCTION = `You are a data-quality auditor for a staff attendance-tracking system.

You will be given a target date. Use the available tools to inspect that day's data:
- get_attendance_summaries: day-level attendance summaries and their raw clock-in/out records
- get_leave_records: leave requests and granted leave overlapping the date
- get_amend_requests: staff-submitted amendment ("amend record") requests for the date
- get_users_lite: a lightweight user directory, to check for references to archived/deleted/missing users

Call each tool at least once for the target date, then look for concrete data-quality issues, such as:
- A clocked-in Attendance record with a null clockOut on a day that has clearly ended
- An AttendanceSummary or Attendance row referencing a userId that does not exist in the user list, or that belongs to an archived/deleted user
- Inconsistent durations (e.g. totalWorkDuration is 0 despite clockIn and clockOut both being set)
- An Attendance row with a null summaryId (not linked to any AttendanceSummary)
- A LeaveRequest or Leave with endDate before startDate, or missing a required field
- An AttendanceRequest stuck with an implausible or missing status

Only report issues you can point to concretely using the tool data returned — do not speculate about
records you have not fetched. If you find no issues, return an empty findings array. Do not invent
entityIds; use the exact id values returned by the tools.`

export const selfCheckAgent = new LlmAgent({
    name: "attendance_self_check_agent",
    model: SELF_CHECK_CONFIG.modelName,
    description: "Audits a single day's attendance-related data for null values and inconsistencies.",
    instruction: INSTRUCTION,
    tools: selfCheckTools,
    outputSchema: findingsOutputSchema,
    outputKey: "structured_findings",
})
