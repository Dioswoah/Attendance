
import { google } from 'googleapis';

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

    // Create email content
    const emailContent = `From: "${userName}" <${userEmail}>
To: ${managerEmail}
Subject: Leave Request: ${userName} - ${leaveType}
Content-Type: text/html; charset=utf-8

<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #e0e0e0;">
    <h2 style="margin: 0; color: #d32f2f;">Leave Request Notification</h2>
  </div>
  <div style="padding: 20px;">
    <p>Hi <strong>${managerName}</strong>,</p>
    <p><strong>${userName}</strong> has submitted a new leave request that requires your attention.</p>
    
    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Leave Type:</strong> ${leaveType}</p>
      <p style="margin: 5px 0;"><strong>Period:</strong> ${startDate} to ${endDate}</p>
      <p style="margin: 5px 0;"><strong>Duration:</strong> ${duration}</p>
      ${reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
    </div>

    <p>This is a reminder that there is a pending approval for this request.</p>
    <p>Please log in to the <a href="${process.env.NEXTAUTH_URL}" style="color: #d32f2f; text-decoration: none; font-weight: bold;">User Portal</a> to review and take action.</p>
  </div>
  <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0;">
    <p style="margin: 0;">This is an automated message. Please do not reply directly to this email unless you intend to contact the employee.</p>
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
    console.log(`[Email Service] Attempting to send STATUS UPDATE email from ${managerEmail} to ${userEmail}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );

    oauth2Client.setCredentials({ access_token: managerAccessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const statusText = status === 'APPROVED' ? 'Approved' : 'Unable to Approve';
    const displayStatus = status === 'APPROVED' ? 'Approved' : 'Not Approved';
    // Use a softer color for declined/not approved (e.g., slate/grey or muted red) instead of harsh red
    const color = status === 'APPROVED' ? '#2e7d32' : '#718096';

    const emailContent = `From: "${managerName}" <${managerEmail}>
To: ${userEmail}
Subject: Update regarding your Leave Request
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #4a5568; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: ${color}; padding: 20px; text-align: center;">
    <h2 style="margin: 0; color: #ffffff; font-weight: 600;">Leave Request Update</h2>
  </div>
  <div style="padding: 32px 24px;">
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Your leave request has been reviewed by <strong>${managerName}</strong>.</p>
    
    <div style="background-color: #f8fafc; padding: 20px; border-radius: 12px; margin: 24px 0; border-left: 4px solid ${color}; border: 1px solid #e2e8f0;">
      <p style="margin: 8px 0;"><strong>Status:</strong> <span style="color: ${color}; font-weight: bold;">${displayStatus}</span></p>
      <p style="margin: 8px 0;"><strong>Leave Type:</strong> ${leaveType}</p>
      <p style="margin: 8px 0;"><strong>Dates:</strong> ${startDate} to ${endDate}</p>
      ${status === 'DECLINED' && declineReason ? `<p style="margin: 8px 0; color: #4a5568;"><strong>Note from Manager:</strong> ${declineReason}</p>` : ''}
    </div>

    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Please check the <a href="${process.env.NEXTAUTH_URL}" style="color: ${color}; text-decoration: none; font-weight: bold;">User Portal</a> for full details.</p>
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
    console.log(`[Email Service] Sending ${action} email to ${managerEmail} from ${userEmail}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET,
      process.env.NEXTAUTH_URL
    );

    oauth2Client.setCredentials({ access_token: userAccessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Try to maintain threading by using a similar subject
    const subject = `Re: Leave Request: ${userName} - ${leaveType}`;
    const actionText = action === 'UPDATED' ? 'updated' : 'cancelled';
    const color = action === 'UPDATED' ? '#1976d2' : '#757575'; // Blue for update, Grey for cancel

    const emailContent = `From: "${userName}" <${userEmail}>
To: ${managerEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: ${color}; padding: 20px; text-align: center;">
    <h2 style="margin: 0; color: #ffffff;">Leave Request ${actionText === 'updated' ? 'Updated' : 'Cancelled'}</h2>
  </div>
  <div style="padding: 20px;">
    <p>Hi <strong>${managerName}</strong>,</p>
    <p><strong>${userName}</strong> has ${actionText} their leave request.</p>
    
    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Leave Type:</strong> ${leaveType}</p>
      <p style="margin: 5px 0;"><strong>Period:</strong> ${startDate} to ${endDate}</p>
      ${action === 'UPDATED' ? '<p style="margin: 5px 0; font-style: italic;">The request details have been modified.</p>' : ''}
    </div>

    <p>Please log in to the <a href="${process.env.NEXTAUTH_URL}" style="color: ${color}; text-decoration: none; font-weight: bold;">Admin Portal</a> to review.</p>
  </div>
  <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0;">
    <p style="margin: 0;">This is an automated message.</p>
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
    console.log(`[Email Service] Sending Admin Action (${actionType}) email to ${userEmail}`);

    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET,
      process.env.NEXTAUTH_URL
    );

    oauth2Client.setCredentials({ access_token: adminAccessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const subject = `Administration Update: New ${actionType.toLowerCase()} entry added`;
    const themeColor = '#6366f1'; // Indigo for admin updates

    const emailContent = `From: "${adminName}" <${adminEmail}>
To: ${userEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: ${themeColor}; padding: 32px 24px; text-align: center;">
    <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">Record Update</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px; color: #1e293b;">Hi <strong>${userName}</strong>,</p>
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
      An administrator has recently updated your profile with a new <strong>${actionType.toLowerCase()}</strong> record. This ensures all your time-tracking information remains complete and accurate.
    </p>
    
    <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid #e2e8f0;">
      <div style="margin-bottom: 12px; display: flex; align-items: flex-start;">
        <span style="color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; width: 100px; display: block;">Date</span>
        <span style="color: #0f172a; font-weight: 600; font-size: 16px;">${date}</span>
      </div>
      <div style="display: flex; align-items: flex-start;">
        <span style="color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; width: 100px; display: block;">Details</span>
        <span style="color: #0f172a; font-weight: 500; font-size: 15px; line-height: 1.5;">${details}</span>
      </div>
    </div>

    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
      You can review this new entry and all your other records anytime through your personal dashboard.
    </p>

    <div style="text-align: center;">
      <a href="${process.env.NEXTAUTH_URL}" style="display: inline-block; background-color: ${themeColor}; color: #ffffff; text-decoration: none; font-weight: 600; padding: 16px 32px; border-radius: 12px; font-size: 16px;">Review Records</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is an administrative notification.<br/>Designed to help you stay informed about your profile updates.</p>
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

    const subject = "Quick Check-in: Break Status ☕";
    // Soft, friendly colors
    const headerColor = '#60A5FA'; // Soft Blue

    const emailContent = `From: "Attendance System" <${userEmail}>
To: ${userEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #374151; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: ${headerColor}; padding: 32px 24px; text-align: center;">
    <div style="font-size: 48px; margin-bottom: 12px;">☕</div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 600; font-size: 24px;">Break Time Check-in</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Hope you're having a good break! Just sending a friendly notification as your break time has reached <strong>${totalBreakTime}</strong> today (daily guideline: ${limit}).
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      If you're ready to jump back in, you can end your break with one click below.
    </p>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${actionLink}" style="display: inline-block; background-color: ${headerColor}; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 99px; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(96, 165, 250, 0.4);">
        End Break & Clock In
      </a>
    </div>

    <p style="font-size: 14px; color: #6b7280; text-align: center;">
      (No worries if you need a bit more time! This is just to help you keep track.)
    </p>
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

interface ForgottenClockOutEmailProps {
  userName: string;
  userEmail: string;
  userAccessToken: string;
  date: string;
}

export async function sendForgottenClockOutEmail({
  userName,
  userEmail,
  userAccessToken,
  date
}: ForgottenClockOutEmailProps) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );
    oauth2Client.setCredentials({ access_token: userAccessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const emailContent = `From: "Attendance System" <${userEmail}>
To: ${userEmail}
Subject: Friendly Reminder: Attendance Status Cleanup
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #334155; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  <div style="background-color: #64748b; padding: 32px 24px; text-align: center;">
    <div style="font-size: 48px; margin-bottom: 16px;">⏱️</div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 700; font-size: 24px; letter-spacing: -0.025em;">Attendance Status Update</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 18px; line-height: 1.6; margin-bottom: 24px; color: #1e293b;">Hi <strong>${userName}</strong>,</p>
    
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
      Our system noticed that your session for <strong>${date}</strong> remained active after the end of the day. To keep your attendance records accurate, we have automatically finalized the record for that day.
    </p>

    <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; margin: 32px 0; border: 1px solid #e2e8f0; text-align: center;">
      <p style="margin: 0; color: #64748b; font-size: 14px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Updated Record</p>
      <p style="margin: 8px 0; color: #0f172a; font-weight: 700; font-size: 18px;">${date}</p>
      <p style="margin: 0; color: #94a3b8; font-size: 13px;">Status: Finalized at 11:59 PM</p>
    </div>
    
    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 24px;">
      If this was intentional or if any adjustments are needed to the finalized time, please don't hesitate to reach out to your administrator to update the record manually.
    </p>

    <p style="font-size: 16px; line-height: 1.7; margin-bottom: 32px;">
      For future days, please remember to click <strong>"Clock Out"</strong> via the portal before heading off to ensure everything is captured correctly.
    </p>

    <div style="text-align: center;">
      <a href="${process.env.NEXTAUTH_URL}" style="display: inline-block; background-color: #64748b; color: #ffffff; text-decoration: none; font-weight: 600; padding: 16px 32px; border-radius: 12px; font-size: 16px;">View Attendance Records</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 24px; text-align: center; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.5;">This is an automated maintenance notification.<br/>Designed to keep your profile status current.</p>
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

    const subject = "Check In: Start Your Shift? ⏰";
    const headerColor = '#F59E0B'; // Amber

    const emailContent = `From: "Attendance System" <${userEmail}>
To: ${userEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #374151; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: ${headerColor}; padding: 32px 24px; text-align: center;">
    <div style="font-size: 48px; margin-bottom: 12px;">⏰</div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 600; font-size: 24px;">Time to Clock In?</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      We noticed you haven't clocked in yet for your shift scheduled at <strong>${scheduledStart}</strong>. 
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
      If you're already online and just forgot, you can clock in immediately using the button below. If you're running late or on leave, you can ignore this safe in the knowledge that we've checked in.
    </p>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${actionLink}" style="display: inline-block; background-color: ${headerColor}; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 99px; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.4);">
        Clock In Now
      </a>
    </div>
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

    const subject = "Check Out Reminder: Shift Ended? 🌙";
    const headerColor = '#6366F1'; // Indigo

    const emailContent = `From: "Attendance System" <${userEmail}>
To: ${userEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #374151; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: ${headerColor}; padding: 32px 24px; text-align: center;">
    <div style="font-size: 48px; margin-bottom: 12px;">🌙</div>
    <h2 style="margin: 0; color: #ffffff; font-weight: 600; font-size: 24px;">Shift Wrap-Up</h2>
  </div>
  <div style="padding: 40px 32px;">
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      Just a friendly reminder that your scheduled shift ended around <strong>${scheduledEnd}</strong>, and you're still clocked in.
    </p>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
       If you're done for the day, simply click below to clock out. If you're working late, feel free to ignore this message!
    </p>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="${actionLink}" style="display: inline-block; background-color: ${headerColor}; color: #ffffff; text-decoration: none; font-weight: 600; padding: 14px 28px; border-radius: 99px; font-size: 16px; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.4);">
        Clock Out Now
      </a>
    </div>
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

    const emailContent = `From: "Attendance System" <me>
To: ${toEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Inter', sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-bottom: 1px solid #e0e0e0;">
    <h2 style="margin: 0; color: #333;">${title}</h2>
  </div>
  <div style="padding: 20px;">
    <p style="font-size: 16px; line-height: 1.6;">${message}</p>
    
    ${link ? `
    <div style="text-align: center; margin-top: 24px;">
      <a href="${link}" style="display: inline-block; background-color: #000; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: bold;">${linkText}</a>
    </div>
    ` : ''}
  </div>
  <div style="background-color: #f8f9fa; padding: 15px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0;">
    <p style="margin: 0;">Automated Notification</p>
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
