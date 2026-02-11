
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROVIDERS_FILE = 'src/components/providers.tsx';
const ARTIFACTS_DIR = 'qa_artifacts_v2';

// --- MOCK SESSIONS ---
const MOCK_USER_SESSION = `
const MOCK_SESSION = {
    expires: "2030-01-01T00:00:00.000Z",
    user: {
        name: "QA USER",
        email: "qa@redadair.com.au",
        image: null,
        id: "cml7a4uas00009c0b7s6sp0k6",
        department: "Operations",
        roles: ["USER"],
        managerId: null,
        availabilityStatus: "AVAILABLE"
    }
};
`;

const MOCK_ADMIN_SESSION = `
const MOCK_SESSION = {
    expires: "2030-01-01T00:00:00.000Z",
    user: {
        name: "ADMIN USER",
        email: "admin@redadair.com.au",
        image: null,
        id: "cml4cnsc80005heyh663zw75m",
        department: "Management",
        roles: ["ADMIN", "MANAGER", "USER"],
        managerId: null,
        availabilityStatus: "AVAILABLE"
    }
};
`;

const PROVIDER_TEMPLATE = (sessionBlock) => `
"use client"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"

${sessionBlock}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider session={MOCK_SESSION}>
            {children}
            <Toaster position="top-right" richColors />
        </SessionProvider>
    )
}
`;

// --- TEST HELPERS ---
async function runStep(page, stepName, actionFn) {
    console.log(`[START] ${stepName}`);
    try {
        await actionFn();
        console.log(`[PASS] ${stepName}`);
        await page.screenshot({ path: path.join(ARTIFACTS_DIR, `${stepName}.png`), fullPage: false });
    } catch (e) {
        console.error(`[FAIL] ${stepName}: ${e.message}`);
        try {
            await page.screenshot({ path: path.join(ARTIFACTS_DIR, `${stepName}_FAIL.png`) });
        } catch (_) { }
    }
}

async function injectSession(type) {
    console.log(`\n--- INJECTING ${type} SESSION ---`);
    const block = type === 'ADMIN' ? MOCK_ADMIN_SESSION : MOCK_USER_SESSION;
    fs.writeFileSync(PROVIDERS_FILE, PROVIDER_TEMPLATE(block));
    // Wait for Next.js Fast Refresh
    await new Promise(r => setTimeout(r, 6000));
}

(async () => {
    if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR);
    const browser = await chromium.launch({ headless: true });

    // ==========================================
    // PHASE 1: USER TESTING
    // ==========================================
    await injectSession('USER');

    const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await context.newPage();

    console.log("Navigating to User Dashboard...");
    try {
        await page.goto('http://localhost:3000/user', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(5000); // Wait for hydration and data fetch

        // 1. DASHBOARD LOAD
        await runStep(page, '01_User_Dashboard_Loaded', async () => {
            await page.waitForSelector('text=Redadair', { timeout: 10000 });
            await page.waitForSelector('text=QA USER');
        });

        // 2. ATTENDANCE INTERACTION
        await runStep(page, '02_Attendance_Card', async () => {
            // Check for any attendance button
            const btn = page.locator('button:has-text("Clock In"), button:has-text("Start Break"), button:has-text("End Break"), button:has-text("Clock Out")').first();
            if (await btn.isVisible()) {
                console.log(`Found attendance button: ${await btn.textContent()}`);
                // Don't click to avoid side effects in DB, just verify visibility
                await btn.hover();
            } else {
                throw new Error("No attendance action button found");
            }
        });

        // 3. NAVIGATION TO LEAVES
        await runStep(page, '03_Navigate_Leaves', async () => {
            await page.goto('http://localhost:3000/user/leaves');
            await page.waitForSelector('text=Leave Requests');
            await page.waitForSelector('text=New Request', { state: 'visible' });
        });

        // 4. LEAVE REQUEST MODAL
        await runStep(page, '04_Leave_Request_Detailed', async () => {
            const newReqBtn = page.getByText('New Request').first();
            await newReqBtn.click();

            // Wait for dialog
            await page.waitForSelector('[role="dialog"]');

            // Interact with form (Fill data)
            await page.fill('textarea[placeholder*="reason"]', "QA Automated Test Reason");

            // Screenshot the filled form
            await page.screenshot({ path: path.join(ARTIFACTS_DIR, `04b_Leave_Form_Filled.png`) });

            // Close dialog (don't submit to avoid junk data)
            await page.keyboard.press('Escape');
        });

    } catch (e) {
        console.error("Global User Test Error:", e);
    } finally {
        await context.close();
    }

    // ==========================================
    // PHASE 2: ADMIN TESTING
    // ==========================================
    await injectSession('ADMIN');

    const adminContext = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const adminPage = await adminContext.newPage();

    console.log("Navigating to Admin Dashboard...");
    try {
        await adminPage.goto('http://localhost:3000/admin', { waitUntil: 'domcontentloaded' });
        await adminPage.waitForTimeout(5000);

        // 5. ADMIN DASHBOARD
        await runStep(adminPage, '05_Admin_Dashboard_Loaded', async () => {
            await adminPage.waitForSelector('text=Staff Overview', { timeout: 10000 });
            // Verify specific admin elements
            const stats = adminPage.locator('text=Total Employees');
            if (await stats.count() === 0) console.warn("Warning: Total Employees stat not found");
        });

        // 6. STAFF LIST
        await runStep(adminPage, '06_Staff_Management', async () => {
            await adminPage.goto('http://localhost:3000/admin/staff');
            await adminPage.waitForSelector('text=Staff Management');
            await adminPage.waitForSelector('table'); // Ensure table loads

            const rows = adminPage.locator('tbody tr');
            console.log(`Found ${await rows.count()} staff rows`);
        });

    } catch (e) {
        console.error("Global Admin Test Error:", e);
    } finally {
        await adminContext.close();
    }

    await browser.close();
    console.log("DONE");
})();
