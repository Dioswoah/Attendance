
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

    const subject = `Record Update: New ${actionType.toLowerCase()} entry added`;
    const color = '#ff9800'; // Orange for admin action

    const emailContent = `From: "${adminName}" <${adminEmail}>
To: ${userEmail}
Subject: ${subject}
Content-Type: text/html; charset=utf-8

<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: ${color}; padding: 20px; text-align: center;">
    <h2 style="margin: 0; color: #ffffff;">New Record Added</h2>
  </div>
  <div style="padding: 20px;">
    <p>Hi <strong>${userName}</strong>,</p>
    <p>An administrator has manually added a new <strong>${actionType.toLowerCase()}</strong> record to your profile.</p>
    
    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 5px 0;"><strong>Date:</strong> ${date}</p>
      <p style="margin: 5px 0;"><strong>Details:</strong> ${details}</p>
    </div>

    <p>Please log in to the <a href="${process.env.NEXTAUTH_URL}" style="color: ${color}; text-decoration: none; font-weight: bold;">User Portal</a> to review your records.</p>
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
}

export async function sendBreakLimitEmail({
  userName,
  userEmail,
  userAccessToken,
  totalBreakTime,
  limit
}: BreakLimitEmailProps) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.AUTH_GOOGLE_ID,
      process.env.AUTH_GOOGLE_SECRET
    );
    oauth2Client.setCredentials({ access_token: userAccessToken });
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const emailContent = `From: "Attendance System" <${userEmail}>
To: ${userEmail}
Subject: Friendly Reminder: Break Time Check-in
Content-Type: text/html; charset=utf-8

<div style="font-family: 'Segoe UI', Arial, sans-serif; color: #4a5568; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
  <div style="background-color: #F59E0B; padding: 24px; text-align: center;">
    <h2 style="margin: 0; color: #ffffff; font-weight: 600; font-size: 20px;">Break Time Check-in</h2>
  </div>
  <div style="padding: 32px 24px;">
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">Hi <strong>${userName}</strong>,</p>
    
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      I would like to check in with you. It seems like you might have forgotten to end your break, as the recorded time has gone slightly over the daily allocation.
    </p>
    
    <div style="background-color: #FFFBEB; padding: 20px; border-radius: 12px; margin: 24px 0; border: 1px solid #FCD34D;">
      <p style="margin: 8px 0; color: #92400E;"><strong>Daily Allocation:</strong> ${limit}</p>
      <p style="margin: 8px 0; color: #92400E;"><strong>Recorded Today:</strong> ${totalBreakTime}</p>
    </div>

    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 8px;">
      If you are already back at work, please remember to clock back in via the portal.
    </p>
    <p style="font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
      If you need a bit more time or if this is an error, please feel free to let your manager know.
    </p>

    <div style="text-align: center; margin-top: 32px;">
      <a href="${process.env.NEXTAUTH_URL}" style="display: inline-block; background-color: #F59E0B; color: #ffffff; text-decoration: none; font-weight: 600; padding: 12px 24px; border-radius: 8px; font-size: 16px;">Go to User Portal</a>
    </div>
  </div>
  <div style="background-color: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0;">This is an automated message sent with care.</p>
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
    console.log("[Email Service] Break limit email sent.");
  } catch (error) {
    console.error("[Email Service] FAILED to send break limit email:", error);
  }
}
