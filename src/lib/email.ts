
import { google } from 'googleapis';
import { prisma } from './prisma'; // Changed from @/lib/prisma to avoid alias issues in server.ts

// Helper to check if emails are enabled
async function isEmailEnabled(): Promise<boolean> {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: 'email_notifications_enabled' }
    });
    // Default to true if setting doesn't exist yet
    return setting ? setting.value === 'true' : true;
  } catch (error) {
    console.warn("Failed to check email settings, defaulting to true:", error);
    return true;
  }
}

interface LeaveRequestEmailProps {
  managerName: string;
  managerEmail: string;
  userName: string;
  userEmail: string;
  userAccessToken: string; // OAuth2 access token from the user's session
  leaveType: string;
  startDate: string;
  endDate: string;
  duration: string;
  reason?: string;
  leaveId: string;
}


export async function sendLeaveRequestEmail({
  managerName,
  managerEmail,
  userName,
  userEmail,
  userAccessToken,
  leaveType,
  startDate,
  endDate,
  duration,
  reason,
}: LeaveRequestEmailProps) {
  try {
    const enabled = await isEmailEnabled();
    if (!enabled) {
      console.log(`[Email Service] SKIPPED sending email to ${managerEmail} (Global setting disabled)`);
      return;
    }

    console.log(`[Email Service] Attempting to send email to ${managerEmail} from ${userEmail} using Gmail API`);

    // Set up OAuth2 client with the user's access token
    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET,
      process.env.NEXTAUTH_URL
    );

    oauth2Client.setCredentials({
      access_token: userAccessToken,
    });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';
    const emailContent = `From: "${userName}" <${userEmail}>
To: ${managerEmail}
Subject: [RSA] Leave Request: ${userName} - ${leaveType}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #8B2323; padding: 32px 24px; text-align: center;">
    <div style="margin-bottom: 16px;">
       <img src="${appUrl}/logo.png" alt="Redadair" style="width: 64px; height: 64px; object-fit: contain; background: white; padding: 8px; border-radius: 16px;" />
    </div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">Leave Request Notification</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px; color: #1e293b;">Hi <strong>${managerName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">Hope you're having a great day! <strong>${userName}</strong> has just submitted a new leave request that requires your friendly review.</p>
    
    <div style="background-color: #fef2f2; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid #fecaca;">
      <p style="margin: 8px 0; color: #7f1d1d;"><strong>Leave Type:</strong> ${leaveType}</p>
      <p style="margin: 8px 0; color: #7f1d1d;"><strong>Period:</strong> ${startDate} to ${endDate}</p>
      <p style="margin: 8px 0; color: #7f1d1d;"><strong>Duration:</strong> ${duration}</p>
      ${reason ? `<p style="margin: 8px 0; color: #7f1d1d;"><strong>Reason:</strong> ${reason}</p>` : ''}
    </div>

    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">Whenever you have a moment, please log in to the User Portal to review and take action.</p>
    <div style="text-align: center;">
      <a href="${appUrl}/user" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-weight: 600; padding: 16px 32px; border-radius: 12px; font-size: 16px;">Review Request</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is a friendly automated message.<br/>Sent by the Redadair Staff Availability System.</p>
  </div>
</div>`;

    // Encode email in base64url format
    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Send the email
    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMessage,
      },
    });

    console.log("[Email Service] Message sent successfully via Gmail API. ID:", result.data.id);
    return result.data;
  } catch (error) {
    console.error("[Email Service] FAILED to send email via Gmail API:", error);
    // Don't throw, just log. We don't want to block the leave creation if email fails.
  }
}

interface LeaveStatusUpdateEmailProps {
  userName: string;
  userEmail: string;
  managerName: string;
  managerEmail: string;
  managerAccessToken: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: 'APPROVED' | 'DECLINED';
  updatedAt: string;
  declineReason?: string;
}

export async function sendLeaveStatusUpdateEmail({
  userName,
  userEmail,
  managerName,
  managerEmail,
  managerAccessToken,
  leaveType,
  startDate,
  endDate,
  status,
  updatedAt,
  declineReason
}: LeaveStatusUpdateEmailProps) {
  try {
    const enabled = await isEmailEnabled();
    if (!enabled) {
      console.log(`[Email Service] SKIPPED sending STATUS UPDATE email (Global setting disabled)`);
      return;
    }

    console.log(`[Email Service] Attempting to send STATUS UPDATE email from ${managerEmail} to ${userEmail}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );

    oauth2Client.setCredentials({ access_token: managerAccessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const statusText = status === 'APPROVED' ? 'Approved' : 'Unable to Approve';
    const displayStatus = status === 'APPROVED' ? 'Approved' : 'Not Approved';
    const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';

    const emailContent = `From: "${managerName}" <${managerEmail}>
To: ${userEmail}
Subject: [RSA] Update regarding your Leave Request
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #8B2323; padding: 32px 24px; text-align: center;">
    <div style="margin-bottom: 16px;">
       <img src="${appUrl}/logo.png" alt="Redadair" style="width: 64px; height: 64px; object-fit: contain; background: white; padding: 8px; border-radius: 16px;" />
    </div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">Leave Request Update</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px; color: #1e293b;">Hi <strong>${userName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">Your recent leave request has been reviewed by <strong>${managerName}</strong>.</p>
    
    <div style="background-color: #fef2f2; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid #fecaca;">
      <p style="margin: 8px 0; color: #7f1d1d;"><strong>Status:</strong> <span style="font-weight: bold;">${displayStatus}</span></p>
      <p style="margin: 8px 0; color: #7f1d1d;"><strong>Leave Type:</strong> ${leaveType}</p>
      <p style="margin: 8px 0; color: #7f1d1d;"><strong>Dates:</strong> ${startDate} to ${endDate}</p>
      ${status === 'DECLINED' && declineReason ? `<p style="margin: 8px 0; color: #991b1b;"><strong>Note from Manager:</strong> ${declineReason}</p>` : ''}
    </div>

    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">You can view the full details and history of your requests on the portal.</p>
    <div style="text-align: center;">
      <a href="${appUrl}/user" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-weight: 600; padding: 16px 32px; border-radius: 12px; font-size: 16px;">View Dashboard</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is a friendly automated message.<br/>Sent by the Redadair Staff Availability System.</p>
  </div>
</div>`;

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    console.log("[Email Service] Status update email sent successfully.");
  } catch (error) {
    console.error("[Email Service] FAILED to send status update email:", error);
  }
}

interface LeaveActionEmailProps {
  managerName: string;
  managerEmail: string;
  userName: string;
  userEmail: string;
  userAccessToken: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  action: 'UPDATED' | 'CANCELLED';
  originalSubject?: string; // To help with threading
}

export async function sendLeaveActionEmail({
  managerName,
  managerEmail,
  userName,
  userEmail,
  userAccessToken,
  leaveType,
  startDate,
  endDate,
  action,
}: LeaveActionEmailProps) {
  try {
    const enabled = await isEmailEnabled();
    if (!enabled) {
      console.log(`[Email Service] SKIPPED sending ${action} email (Global setting disabled)`);
      return;
    }

    console.log(`[Email Service] Sending ${action} email to ${managerEmail} from ${userEmail}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET,
      process.env.NEXTAUTH_URL
    );

    oauth2Client.setCredentials({ access_token: userAccessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const subject = `[RSA] Leave Request ${action === 'UPDATED' ? 'Updated' : 'Cancelled'}: ${userName}`;
    const actionText = action === 'UPDATED' ? 'updated' : 'cancelled';
    const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';

    const emailContent = `From: "${userName}" <${userEmail}>
To: ${managerEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #8B2323; padding: 32px 24px; text-align: center;">
    <div style="margin-bottom: 16px;">
       <img src="${appUrl}/logo.png" alt="Redadair" style="width: 64px; height: 64px; object-fit: contain; background: white; padding: 8px; border-radius: 16px;" />
    </div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">Leave Request ${actionText === 'updated' ? 'Updated' : 'Cancelled'}</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px; color: #1e293b;">Hi <strong>${managerName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">Just a quick note that <strong>${userName}</strong> has ${actionText} their leave request.</p>
    
    <div style="background-color: #fef2f2; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid #fecaca;">
      <p style="margin: 8px 0; color: #7f1d1d;"><strong>Leave Type:</strong> ${leaveType}</p>
      <p style="margin: 8px 0; color: #7f1d1d;"><strong>Period:</strong> ${startDate} to ${endDate}</p>
      ${action === 'UPDATED' ? '<p style="margin: 8px 0; font-style: italic; color: #991b1b;">The details of the request have been modified by the user.</p>' : ''}
    </div>

    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">For full details and to keep our records aligned, please log in to the portal.</p>
    <div style="text-align: center;">
      <a href="${appUrl}/user" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-weight: 600; padding: 16px 32px; border-radius: 12px; font-size: 16px;">Go to Portal</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is a friendly automated message.<br/>Sent by the Redadair Staff Availability System.</p>
  </div>
</div>`;

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    console.log(`[Email Service] ${action} email sent successfully.`);
  } catch (error) {
    console.error(`[Email Service] FAILED to send ${action} email:`, error);
  }
}

interface AdminActionEmailProps {
  userName: string;
  userEmail: string;
  adminName: string; // "Administrator" or specific admin name
  adminEmail: string;
  adminAccessToken: string;
  actionType: 'ATTENDANCE' | 'LEAVE' | 'BREAK';
  details: string; // "Clocked in at 09:00", "Annual Leave from ...", "Break: 12:00 - 13:00"
  date: string;
}

export async function sendAdminActionEmail({
  userName,
  userEmail,
  adminName,
  adminEmail,
  adminAccessToken,
  actionType,
  details,
  date
}: AdminActionEmailProps) {
  try {
    const enabled = await isEmailEnabled();
    if (!enabled) {
      console.log(`[Email Service] SKIPPED sending Admin Action (${actionType}) email (Global setting disabled)`);
      return;
    }

    console.log(`[Email Service] Sending Admin Action (${actionType}) email to ${userEmail}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET,
      process.env.NEXTAUTH_URL
    );

    oauth2Client.setCredentials({ access_token: adminAccessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const subject = `[RSA] Administration Update: New ${actionType.toLowerCase()} entry added`;
    const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';

    const emailContent = `From: "${adminName}" <${adminEmail}>
To: ${userEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #8B2323; padding: 32px 24px; text-align: center;">
    <div style="margin-bottom: 16px;">
       <img src="${appUrl}/logo.png" alt="Redadair" style="width: 64px; height: 64px; object-fit: contain; background: white; padding: 8px; border-radius: 16px;" />
    </div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">Record Update</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px; color: #1e293b;">Hi <strong>${userName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">An administrator recently updated your profile with a new <strong>${actionType.toLowerCase()}</strong> record to ensure your information stays complete and accurate.</p>
    
    <div style="background-color: #fef2f2; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid #fecaca;">
      <div style="margin-bottom: 12px; display: flex; align-items: flex-start;">
        <span style="color: #991b1b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; width: 100px; display: block;">Date</span>
        <span style="color: #7f1d1d; font-weight: 600; font-size: 16px;">${date}</span>
      </div>
      <div style="display: flex; align-items: flex-start;">
        <span style="color: #991b1b; font-size: 13px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em; width: 100px; display: block;">Details</span>
        <span style="color: #7f1d1d; font-weight: 500; font-size: 15px; line-height: 1.5;">${details}</span>
      </div>
    </div>

    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">You can review this new entry and all your other records anytime on your dashboard.</p>
    <div style="text-align: center;">
      <a href="${appUrl}/user" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-weight: 600; padding: 16px 32px; border-radius: 12px; font-size: 16px;">Review Records</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is a friendly administrative notification.<br/>Sent by the Redadair Staff Availability System.</p>
  </div>
</div>`;

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    console.log(`[Email Service] Admin action email sent successfully.`);
  } catch (error) {
    console.error(`[Email Service] FAILED to send admin action email:`, error);
  }
}

interface BreakLimitEmailProps {
  userName: string;
  userEmail: string;
  userAccessToken: string;
  totalBreakTime: string;
  limit: string;
  actionLink: string; // The URL to end the break
  refreshToken?: string;
}

export async function sendBreakLimitEmail({
  userName,
  userEmail,
  userAccessToken,
  totalBreakTime,
  limit,
  actionLink,
  refreshToken
}: BreakLimitEmailProps): Promise<boolean> {
  try {
    const enabled = await isEmailEnabled();
    if (!enabled) {
      console.log(`[Email Service] SKIPPED sending break limit email (Global setting disabled)`);
      return true;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );
    oauth2Client.setCredentials({
      access_token: userAccessToken,
      refresh_token: refreshToken
    });

    // Auto-refresh if possible (ensure fresh token)
    if (refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
      } catch (e) {
        console.warn("[Email Service] Failed to refresh token, attempting with provided access token", e);
      }
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const subject = "[RSA] Quick Check-in: Break Status";
    const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';

    const emailContent = `From: "Attendance System" <${userEmail}>
To: ${userEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #374151; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #8B2323; padding: 32px 24px; text-align: center;">
    <div style="margin-bottom: 16px;">
       <img src="${appUrl}/logo.png" alt="Redadair" style="width: 64px; height: 64px; object-fit: contain; background: white; padding: 8px; border-radius: 16px;" />
    </div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 600; font-size: 24px;">Break Time Check-in</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">Hope you're having a good break! Just sending a quick, friendly ping since your break time has reached <strong>${totalBreakTime}</strong> today (daily guideline: ${limit}).</p>
    
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">If you're refreshed and ready to jump back in, you can easily end your break and get back to work by clicking below.</p>

    <div style="text-align: center; margin-bottom: 16px;">
      <a href="${actionLink}" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 12px; font-size: 16px;">End Break & Clock In</a>
    </div>

    <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 16px;">(No worries if you still need a bit more time! This is just to help you keep track.)</p>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is a friendly automated message.<br/>Sent by the Redadair Staff Availability System.</p>
  </div>
</div>`;

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    console.log(`[Email Service] Sent break limit email to ${userEmail}`);
    return true;
  } catch (error) {
    console.error("[Email Service] FAILED to send break limit email:", error);
    return false;
  }
}

interface BreakExpectedReturnEmailProps {
  userName: string;
  userEmail: string;
  userAccessToken: string;
  expectedReturnTime: string;
  actionLink: string;
  refreshToken?: string;
}

export async function sendBreakExpectedReturnEmail({
  userName,
  userEmail,
  userAccessToken,
  expectedReturnTime,
  actionLink,
  refreshToken
}: BreakExpectedReturnEmailProps): Promise<boolean> {
  try {
    const enabled = await isEmailEnabled();
    if (!enabled) {
      console.log(`[Email Service] SKIPPED sending break return reminder email (Global setting disabled)`);
      return true;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );
    oauth2Client.setCredentials({
      access_token: userAccessToken,
      refresh_token: refreshToken
    });

    if (refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
      } catch (e) {
        console.warn("[Email Service] Failed to refresh token", e);
      }
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const subject = "[RSA] Friendly Reminder: Are you still on break?";
    const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';

    const emailContent = `From: "Attendance System" <${userEmail}>
To: ${userEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #374151; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #8B2323; padding: 32px 24px; text-align: center;">
    <div style="margin-bottom: 16px;">
       <img src="${appUrl}/logo.png" alt="Redadair" style="width: 64px; height: 64px; object-fit: contain; background: white; padding: 8px; border-radius: 16px;" />
    </div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 600; font-size: 24px;">Break Status Check</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">Just another quick, friendly check-in! Your break was expected to end at around <strong>${expectedReturnTime}</strong>.</p>
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">If you're already back at your desk and working hard, you can easily end your break using the button below to update your status.</p>

    <div style="text-align: center; margin-bottom: 16px;">
      <a href="${actionLink}" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 12px; font-size: 16px;">End Break Now</a>
    </div>

    <p style="font-size: 14px; color: #6b7280; text-align: center; margin-top: 16px;">If you need a little more time, zero problems! We just want to help you stay on track.</p>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is a friendly automated message.<br/>Sent by the Redadair Staff Availability System.</p>
  </div>
</div>`;

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    console.log(`[Email Service] Sent break return reminder email to ${userEmail}`);
    return true;
  } catch (error) {
    console.error("[Email Service] FAILED to send break return reminder email:", error);
    return false;
  }
}

interface ForgottenClockOutEmailProps {
  userName: string;
  userEmail: string;
  userAccessToken: string;
  date: string;
  clockOutTime: string;
  reason: string;
}

export async function sendForgottenClockOutEmail({
  userName,
  userEmail,
  userAccessToken,
  date,
  clockOutTime,
  reason
}: ForgottenClockOutEmailProps) {
  try {
    const enabled = await isEmailEnabled();
    if (!enabled) {
      console.log(`[Email Service] SKIPPED sending forgotten clock-out email (Global setting disabled)`);
      return;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );
    oauth2Client.setCredentials({ access_token: userAccessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';

    const emailContent = `From: "Attendance System" <${userEmail}>
To: ${userEmail}
Subject: [RSA] Friendly Reminder: Your Attendance Session was Auto-Closed
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #8B2323; padding: 32px 24px; text-align: center;">
    <div style="margin-bottom: 16px;">
       <img src="${appUrl}/logo.png" alt="Redadair" style="width: 64px; height: 64px; object-fit: contain; background: white; padding: 8px; border-radius: 16px;" />
    </div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">Attendance Status Update</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px; color: #1e293b;">Hi <strong>${userName}</strong>,</p>
    
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
      Hello! The system noticed that you did not clock out yesterday. We have automatically clocked you out <strong>${reason === 'shift ended' ? 'using the end time of your nominal hours' : 'at'} (${clockOutTime})</strong>.
    </p>

    <div style="background-color: #fef2f2; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid #fecaca; text-align: center;">
      <p style="margin: 0; color: #991b1b; font-size: 14px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.05em;">Updated Record</p>
      <p style="margin: 8px 0; color: #7f1d1d; font-weight: 700; font-size: 18px;">${date}</p>
      <p style="margin: 0; color: #b91c1c; font-size: 13px; font-weight: 600;">Clock Out: ${clockOutTime} (${reason})</p>
    </div>
    
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
      If you forgot to clock out earlier or worked overtime, please request an amended record from your manager.
    </p>

    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
      Please try to remember to click <strong>"Clock Out"</strong> via the portal before heading off next time. Have a wonderful day!
    </p>

    <div style="text-align: center;">
      <a href="${appUrl}/user" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-weight: 600; padding: 16px 32px; border-radius: 12px; font-size: 16px;">View Dashboard</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is a friendly automated reminder.<br/>Sent by the Redadair Staff Availability System.</p>
  </div>
</div>`;

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    console.log("[Email Service] Forgotten clock-out email sent.");
  } catch (error) {
    console.error("[Email Service] FAILED to send forgotten clock-out email:", error);
  }
}

interface EmailResult {
  accepted: string[];
  rejected: string[];
  response: string;
}

export type SendEmailResult = Promise<boolean>;
interface GeneralEmailProps {
  toEmail: string;
  subject: string;
  title: string;
  message: string;
  link?: string;
  linkText?: string;
  accessToken: string; // Sender's access token
}

// ... existing imports

interface LateArrivalEmailProps {
  userName: string;
  userEmail: string;
  userAccessToken: string;
  scheduledStart: string;
  actionLink: string;
  refreshToken?: string;
}

export async function sendLateArrivalEmail({
  userName,
  userEmail,
  userAccessToken,
  scheduledStart,
  actionLink,
  refreshToken
}: LateArrivalEmailProps): Promise<boolean> {
  try {
    const enabled = await isEmailEnabled();
    if (!enabled) {
      console.log(`[Email Service] SKIPPED sending late arrival email (Global setting disabled)`);
      return true;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );
    oauth2Client.setCredentials({
      access_token: userAccessToken,
      refresh_token: refreshToken
    });

    // Auto-refresh if possible (ensure fresh token)
    if (refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
      } catch (e) {
        console.warn("[Email Service] Failed to refresh token, attempting with provided access token", e);
      }
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const subject = "[RSA] Check In: Start Your Shift?";
    const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';

    const emailContent = `From: "Attendance System" <${userEmail}>
To: ${userEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #374151; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #8B2323; padding: 32px 24px; text-align: center;">
    <div style="margin-bottom: 16px;">
       <img src="${appUrl}/logo.png" alt="Redadair" style="width: 64px; height: 64px; object-fit: contain; background: white; padding: 8px; border-radius: 16px;" />
    </div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 600; font-size: 24px;">Time to Clock In?</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Just checking in — we noticed you haven't clocked in yet for your shift scheduled at <strong>${scheduledStart}</strong>.</p>
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 32px;">If you're already online and simply forgot, you can clock in immediately using the button below. If you're running late or on leave, feel free to ignore this safely!</p>

    <div style="text-align: center; margin-bottom: 16px;">
      <a href="${actionLink}" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 12px; font-size: 16px;">Clock In Now</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is a friendly automated message.<br/>Sent by the Redadair Staff Availability System.</p>
  </div>
</div>`;

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    console.log("[Email Service] Late arrival email sent.");
    return true;
  } catch (error) {
    console.error(`[Email Service] FAILED to send late arrival email:`, error);
    return false;
  }
}

interface OverdueDepartureEmailProps {
  userName: string;
  userEmail: string;
  userAccessToken: string;
  scheduledEnd: string;
  actionLink: string;
  refreshToken?: string;
}

export async function sendOverdueDepartureEmail({
  userName,
  userEmail,
  userAccessToken,
  scheduledEnd,
  actionLink,
  refreshToken
}: OverdueDepartureEmailProps): Promise<boolean> {
  try {
    const enabled = await isEmailEnabled();
    if (!enabled) {
      console.log(`[Email Service] SKIPPED sending overdue departure email (Global setting disabled)`);
      return true;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );
    oauth2Client.setCredentials({
      access_token: userAccessToken,
      refresh_token: refreshToken
    });

    // Auto-refresh if possible (ensure fresh token)
    if (refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        oauth2Client.setCredentials(credentials);
      } catch (e) {
        console.warn("[Email Service] Failed to refresh token, attempting with provided access token", e);
      }
    }

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const subject = "[RSA] Check Out Reminder: Shift Ended?";
    const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';

    const emailContent = `From: "Attendance System" <${userEmail}>
To: ${userEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #374151; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #8B2323; padding: 32px 24px; text-align: center;">
    <div style="margin-bottom: 16px;">
       <img src="${appUrl}/logo.png" alt="Redadair" style="width: 64px; height: 64px; object-fit: contain; background: white; padding: 8px; border-radius: 16px;" />
    </div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 600; font-size: 24px;">Shift Wrap-Up</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Just a friendly reminder that your scheduled shift ended around <strong>${scheduledEnd}</strong>, and you're still clocked in.</p>
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 32px;">If you're all done for the day, please click below to clock out. If you're working a little late, no problem at all — feel free to ignore this message!</p>

    <div style="text-align: center; margin-bottom: 16px;">
      <a href="${actionLink}" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 12px; font-size: 16px;">Clock Out Now</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is a friendly automated message.<br/>Sent by the Redadair Staff Availability System.</p>
  </div>
</div>`;

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    console.log("[Email Service] Overdue departure email sent.");
    return true;
  } catch (error) {
    console.error("[Email Service] FAILED to send overdue departure email:", error);
    return false;
  }
}

export async function sendGeneralEmail({
  toEmail,
  subject,
  title,
  message,
  link,
  linkText = "View Details",
  accessToken
}: GeneralEmailProps) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const appUrl = process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app';

    const emailContent = `From: "Attendance System" <me>
To: ${toEmail}
Subject: [RSA] ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #8B2323; padding: 32px 24px; text-align: center;">
    <div style="margin-bottom: 16px;">
       <img src="${appUrl}/logo.png" alt="Redadair" style="width: 64px; height: 64px; object-fit: contain; background: white; padding: 8px; border-radius: 16px;" />
    </div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">${title}</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">${message}</p>
    
    ${link ? `
    <div style="text-align: center; margin-top: 32px; margin-bottom: 16px;">
      <a href="${link}" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 12px; font-size: 16px;">${linkText}</a>
    </div>
    ` : ''}
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is a friendly automated message.<br/>Sent by the Redadair Staff Availability System.</p>
  </div>
</div>`;

    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });
    console.log(`[Email Service] General email sent to ${toEmail}`);
  } catch (error) {
    console.error("[Email Service] FAILED to send general email:", error);
  }
}
