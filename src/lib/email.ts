
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

    const color = status === 'APPROVED' ? '#2e7d32' : '#c62828';
    const statusText = status === 'APPROVED' ? 'Approved' : 'Declined';

    const emailContent = `From: "${managerName}" <${managerEmail}>
To: ${userEmail}
Subject: Leave Request Updated: ${statusText}
Content-Type: text/html; charset=utf-8

<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
  <div style="background-color: ${color}; padding: 20px; text-align: center;">
    <h2 style="margin: 0; color: #ffffff;">Leave Request ${statusText}</h2>
  </div>
  <div style="padding: 20px;">
    <p>Hi <strong>${userName}</strong>,</p>
    <p>Your leave request has been reviewed by <strong>${managerName}</strong>.</p>
    
    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid ${color};">
      <p style="margin: 5px 0;"><strong>Status:</strong> <span style="color: ${color}; font-weight: bold;">${status}</span></p>
      <p style="margin: 5px 0;"><strong>Leave Type:</strong> ${leaveType}</p>
      <p style="margin: 5px 0;"><strong>Dates:</strong> ${startDate} to ${endDate}</p>
      ${status === 'DECLINED' && declineReason ? `<p style="margin: 5px 0; color: #d32f2f;"><strong>Reason for Decline:</strong> ${declineReason}</p>` : ''}
    </div>

    <p>Please check the <a href="${process.env.NEXTAUTH_URL}" style="color: ${color}; text-decoration: none; font-weight: bold;">User Portal</a> for full details.</p>
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
