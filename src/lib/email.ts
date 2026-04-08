import nodemailer from 'nodemailer';
import { prisma } from './prisma';

const SENDER_EMAIL = '"Staff Availability" <staffavailability@redadair.com.au>';

const transporter = nodemailer.createTransport({
    host: 'smtp.zeptomail.com',
    port: 587,
    auth: {
        user: 'emailapikey',
        pass: process.env.ZEPTOMAIL_PASSWORD,
    },
});

async function isEmailEnabled(): Promise<boolean> {
    try {
        const setting = await prisma.systemSettings.findUnique({
            where: { key: 'email_notifications_enabled' }
        });
        return setting ? setting.value === 'true' : true;
    } catch (error) {
        console.warn("Failed to check email settings, defaulting to true:", error);
        return true;
    }
}

interface TemplateProps {
    title: string;
    subtitle?: string;
    buttonText: string;
    buttonLink: string;
    greetingName?: string;
    bodyHtml: string;
}

function buildEmailHtml(props: TemplateProps): string {
    const { title, subtitle, buttonText, buttonLink, greetingName, bodyHtml } = props;

    return `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
  
  <div style="background-color: #8B2323; padding: 35px 20px; color: #ffffff; text-align: center;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">${title}</h1>
    ${subtitle ? `<p style="margin: 8px 0 0 0; font-size: 15px; opacity: 0.9;">${subtitle}</p>` : ''}
  </div>

  <div style="background-color: #ffffff; padding: 35px 30px;">
    
    <div style="text-align: left; color: #1e293b; margin-bottom: 30px;">
      ${greetingName ? `<p style="font-size: 16px; font-weight: 700; margin-top: 0; margin-bottom: 16px; color: #0f172a;">Hi ${greetingName},</p>` : ''}
      
      <div style="font-size: 15px; line-height: 1.6; color: #475569;">
        ${bodyHtml}
      </div>
    </div>

    <div style="text-align: center; margin-top: 20px;">
      <a href="${buttonLink}" style="display: inline-block; background-color: #8B2323; color: #ffffff; text-decoration: none; font-size: 15px; padding: 12px 28px; border-radius: 8px; font-weight: 600; transition: background-color 0.2s;">
        ${buttonText}
      </a>
    </div>

  </div>

  <div style="background-color: #f1f5f9; padding: 20px; text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #e2e8f0;">
    <p style="margin: 0; line-height: 1.6;">This is an automated message from the <strong>Redadair Staff Availability System</strong>.<br/>Please do not reply directly to this email.</p>
  </div>

</div>
  `;
}

interface LeaveRequestEmailProps { managerName: string; managerEmail: string; userName: string; userEmail: string; userAccessToken: string; leaveType: string; startDate: string; endDate: string; duration: string; reason?: string; leaveId: string; refreshToken?: string; customTitle?: string; }
export async function sendLeaveRequestEmail({ managerName, managerEmail, userName, userEmail, leaveType, startDate, endDate, duration, reason, customTitle }: LeaveRequestEmailProps) {
    try {
        if (!(await isEmailEnabled())) return;
        const displayTitle = customTitle || `Leave Request: ${userName.toUpperCase()}`;
        const html = buildEmailHtml({
            title: displayTitle,
            subtitle: `${startDate} - ${endDate}`,
            buttonText: 'Review in Portal',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: managerName,
            bodyHtml: `
        <p><strong>${userName}</strong> has submitted a new ${customTitle ? 'request' : 'leave request'} that requires your review.</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Type:</strong> ${leaveType}</p>
            <p style="margin: 5px 0;"><strong>Period:</strong> ${startDate} to ${endDate}</p>
            <p style="margin: 5px 0;"><strong>Total Time:</strong> ${duration}</p>
            ${reason ? `<p style="margin: 5px 0;"><strong>Reason:</strong> ${reason}</p>` : ''}
        </div>
      `
        });
        await transporter.sendMail({ from: SENDER_EMAIL, to: managerEmail, replyTo: userEmail, subject: `[RSA] Leave Request: ${userName} - ${leaveType}`, html });
    } catch (error) {
        console.error("[ZeptoMail] Failed to send leave request email:", error);
    }
}

interface LeaveStatusUpdateEmailProps { userName: string; userEmail: string; managerName: string; managerEmail: string; managerAccessToken: string; leaveType: string; startDate: string; endDate: string; status: 'APPROVED' | 'DECLINED'; updatedAt: string; declineReason?: string; managerRefreshToken?: string; customTitle?: string; }
export async function sendLeaveStatusUpdateEmail({ userName, userEmail, managerName, managerEmail, leaveType, startDate, endDate, status, declineReason, customTitle }: LeaveStatusUpdateEmailProps) {
    try {
        if (!(await isEmailEnabled())) return;
        const displayStatus = status === 'APPROVED' ? 'Approved' : 'Not Approved';
        const displayTitle = customTitle ? `${customTitle} ${displayStatus}` : `Leave Request ${displayStatus}`;

        const html = buildEmailHtml({
            title: displayTitle,
            subtitle: `${startDate} - ${endDate}`,
            buttonText: 'View Details',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: userName,
            bodyHtml: `
        <p>Your recent ${customTitle ? 'correction' : 'leave'} request has been reviewed by <strong>${managerName}</strong>.</p>
        <div style="background-color: ${status === 'APPROVED' ? '#f0fdf4' : '#fef2f2'}; border: 1px solid ${status === 'APPROVED' ? '#dcfce7' : '#fecaca'}; border-radius: 8px; padding: 15px; margin: 20px 0; color: ${status === 'APPROVED' ? '#166534' : '#991b1b'};">
            <p style="margin: 0;"><strong>Status:</strong> ${displayStatus}</p>
            <p style="margin: 5px 0;"><strong>Type:</strong> ${leaveType}</p>
            <p style="margin: 5px 0;"><strong>Dates:</strong> ${startDate} to ${endDate}</p>
            ${status === 'DECLINED' && declineReason ? `<p style="margin: 10px 0 0 0; padding-top: 10px; border-top: 1px solid #fecaca;"><strong>Note:</strong> ${declineReason}</p>` : ''}
        </div>
      `
        });
        const subject = customTitle ? `[RSA] ${customTitle} Correction: ${displayStatus}` : `[RSA] Leave Request ${displayStatus}`;
        await transporter.sendMail({ from: SENDER_EMAIL, to: userEmail, replyTo: managerEmail, subject: subject, html });
    } catch (error) {
        console.error("[ZeptoMail] Failed to send leave status update email:", error);
    }
}

interface LeaveActionEmailProps { managerName: string; managerEmail: string; userName: string; userEmail: string; userAccessToken: string; leaveType: string; startDate: string; endDate: string; action: 'UPDATED' | 'CANCELLED'; originalSubject?: string; refreshToken?: string; }
export async function sendLeaveActionEmail({ managerName, managerEmail, userName, userEmail, leaveType, startDate, endDate, action }: LeaveActionEmailProps) {
    try {
        if (!(await isEmailEnabled())) return;
        const actionText = action === 'UPDATED' ? 'Updated' : 'Cancelled';
        const html = buildEmailHtml({
            title: `Leave Request ${actionText}`,
            subtitle: `${userName}`,
            buttonText: 'Go to Portal',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: managerName,
            bodyHtml: `
        <p><strong>${userName}</strong> has <strong>${actionText.toLowerCase()}</strong> their leave request.</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Leave Type:</strong> ${leaveType}</p>
            <p style="margin: 5px 0;"><strong>Dates:</strong> ${startDate} to ${endDate}</p>
        </div>
        ${action === 'UPDATED' ? '<p style="font-style: italic; color: #64748b;">The details of the request have been modified by the staff member.</p>' : ''}
      `
        });
        await transporter.sendMail({ from: SENDER_EMAIL, to: managerEmail, replyTo: userEmail, subject: `[RSA] Leave Request ${actionText}: ${userName}`, html });
    } catch (error) {
        console.error("[ZeptoMail] Failed to send leave action email:", error);
    }
}

interface AdminActionEmailProps { userName: string; userEmail: string; adminName: string; adminEmail: string; adminAccessToken: string; actionType: 'ATTENDANCE' | 'LEAVE' | 'BREAK'; details: string; date: string; adminRefreshToken?: string; }
export async function sendAdminActionEmail({ userName, userEmail, adminName, adminEmail, actionType, details, date }: AdminActionEmailProps) {
    try {
        if (!(await isEmailEnabled())) return;
        const html = buildEmailHtml({
            title: `Record Updated`,
            subtitle: `Administrative Action`,
            buttonText: 'Review My Records',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: userName,
            bodyHtml: `
        <p>An administrator (<strong>${adminName}</strong>) has updated your <strong>${actionType.toLowerCase()}</strong> record to ensure your information is accurate.</p>
        <div style="background-color: #f1f5f9; border-left: 4px solid #8B2323; padding: 15px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Date:</strong> ${date}</p>
            <p style="margin: 5px 0;"><strong>Details:</strong> ${details}</p>
        </div>
      `
        });
        await transporter.sendMail({ from: SENDER_EMAIL, to: userEmail, replyTo: adminEmail, subject: `[RSA] Administration Update: New ${actionType.toLowerCase()} record added`, html });
    } catch (error) {
        console.error("[ZeptoMail] Failed to send admin action email:", error);
    }
}

interface BreakLimitEmailProps { userName: string; userEmail: string; userAccessToken: string; totalBreakTime: string; limit: string; actionLink: string; refreshToken?: string; }
export async function sendBreakLimitEmail({ userName, userEmail, totalBreakTime, limit, actionLink }: BreakLimitEmailProps): Promise<boolean> {
    try {
        if (!(await isEmailEnabled())) return true;
        const html = buildEmailHtml({
            title: `Break Time Check-in`,
            buttonText: 'End Break Now',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: userName,
            bodyHtml: `
        <p>Hope you're having a good break! We noticed your total break time today has reached <strong>${totalBreakTime}</strong> (current daily guideline: ${limit}).</p>
        <p>If you're refreshed and ready to jump back in, you can easily end your break by clicking the button below.</p>
      `
        });
        await transporter.sendMail({ from: SENDER_EMAIL, to: userEmail, subject: "[RSA] Quick Check-in: Break Status", html });
        return true;
    } catch (error) {
        console.error("[ZeptoMail] Failed to send break limit email:", error);
        return false;
    }
}

interface BreakExpectedReturnEmailProps { userName: string; userEmail: string; userAccessToken: string; expectedReturnTime: string; actionLink: string; refreshToken?: string; }
export async function sendBreakExpectedReturnEmail({ userName, userEmail, expectedReturnTime, actionLink }: BreakExpectedReturnEmailProps): Promise<boolean> {
    try {
        if (!(await isEmailEnabled())) return true;
        const html = buildEmailHtml({
            title: `Still on Break?`,
            buttonText: 'End Break Now',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: userName,
            bodyHtml: `
        <p>Just a friendly check-in! Your break was expected to end around <strong>${expectedReturnTime}</strong>.</p>
        <p>If you're already back at your desk, please click the button below to update your status.</p>
      `
        });
        await transporter.sendMail({ from: SENDER_EMAIL, to: userEmail, subject: "[RSA] Friendly Reminder: Are you still on break?", html });
        return true;
    } catch (error) {
        console.error("[ZeptoMail] Failed to send break return email:", error);
        return false;
    }
}

interface ForgottenClockOutEmailProps { userName: string; userEmail: string; userAccessToken: string; date: string; clockOutTime: string; reason: string; refreshToken?: string; }
export async function sendForgottenClockOutEmail({ userName, userEmail, date, clockOutTime, reason }: ForgottenClockOutEmailProps) {
    try {
        if (!(await isEmailEnabled())) return;
        const html = buildEmailHtml({
            title: `Attendance Session Closed`,
            subtitle: `${date}`,
            buttonText: 'View My Dashboard',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: userName,
            bodyHtml: `
        <p>The system noticed you haven't clocked out. To keep our records complete, we have automatically clocked you out at <strong>${clockOutTime}</strong> (${reason}).</p>
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0; color: #991b1b; text-align: center;">
            <p style="margin: 0; font-size: 14px; text-transform: uppercase; font-weight: 700;">Final Record</p>
            <p style="margin: 5px 0; font-size: 18px; font-weight: 700;">${date}</p>
            <p style="margin: 0;">Clock Out: ${clockOutTime}</p>
        </div>
        <p style="font-size: 14px; color: #64748b;">If you actually worked later, please request an amendment from your manager.</p>
      `
        });
        await transporter.sendMail({ from: SENDER_EMAIL, to: userEmail, subject: "[RSA] Friendly Reminder: Your Attendance Session was Auto-Closed", html });
    } catch (error) {
        console.error("[ZeptoMail] Failed to send forgotten clock-out email:", error);
    }
}

export type SendEmailResult = Promise<boolean>;
interface GeneralEmailProps { toEmail: string; subject: string; title: string; message: string; link?: string; linkText?: string; accessToken: string; refreshToken?: string; }
export async function sendGeneralEmail({ toEmail, subject, title, message, link, linkText = "View Details" }: GeneralEmailProps) {
    try {
        // Fix redundancy: detect if message already has a greeting
        const trimmedMessage = message.trim();
        const hasGreeting = trimmedMessage.toLowerCase().startsWith('hi ') ||
            trimmedMessage.toLowerCase().startsWith('hello ') ||
            trimmedMessage.toLowerCase().startsWith('dear ');

        const html = buildEmailHtml({
            title: title,
            buttonText: linkText || 'View Details',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: hasGreeting ? undefined : 'Team Member',
            bodyHtml: `<p>${trimmedMessage.replace(/\n/g, '<br/>')}</p>`
        });
        await transporter.sendMail({ from: SENDER_EMAIL, to: toEmail, subject: `[RSA] ${subject}`, html });
    } catch (error) {
        console.error("[ZeptoMail] Failed to send general email:", error);
        throw new Error('Email failed to send. Check ZeptoMail setup.');
    }
}

interface LateArrivalEmailProps { userName: string; userEmail: string; userAccessToken: string; scheduledStart: string; actionLink: string; refreshToken?: string; }
export async function sendLateArrivalEmail({ userName, userEmail, scheduledStart, actionLink }: LateArrivalEmailProps): Promise<boolean> {
    try {
        if (!(await isEmailEnabled())) return true;
        const html = buildEmailHtml({
            title: `Ready to Start?`,
            buttonText: 'Clock In Now',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: userName,
            bodyHtml: `
        <p>Just checking in! We noticed you haven't clocked in yet for your shift scheduled at <strong>${scheduledStart}</strong>.</p>
        <p>If you're already online and simply forgot, you can clock in immediately using the button below.</p>
        <p style="font-size: 14px; color: #64748b; margin-top: 20px;">(If you're running late or on leave, feel free to ignore this safely!)</p>
      `
        });
        await transporter.sendMail({ from: SENDER_EMAIL, to: userEmail, subject: "[RSA] Check In: Start Your Shift?", html });
        return true;
    } catch (error) {
        console.error("[ZeptoMail] Failed to send late arrival email:", error);
        return false;
    }
}

interface OverdueDepartureEmailProps { userName: string; userEmail: string; userAccessToken: string; scheduledEnd: string; actionLink: string; refreshToken?: string; }
export async function sendOverdueDepartureEmail({ userName, userEmail, scheduledEnd, actionLink }: OverdueDepartureEmailProps): Promise<boolean> {
    try {
        if (!(await isEmailEnabled())) return true;
        const html = buildEmailHtml({
            title: `Shift Overdue`,
            buttonText: 'Clock Out Now',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: userName,
            bodyHtml: `
        <p>Just a friendly reminder that your scheduled shift ended around <strong>${scheduledEnd}</strong>, and you're still clocked in.</p>
        <p>If you're all done for the day, please click the button below to clock out. If you're still working, no problem — feel free to ignore this message!</p>
      `
        });
        await transporter.sendMail({ from: SENDER_EMAIL, to: userEmail, subject: "[RSA] Check Out Reminder: Shift Ended?", html });
        return true;
    } catch (error) {
        console.error("[ZeptoMail] Failed to send overdue departure email:", error);
        return false;
    }
}

interface LateStaffInfo { name: string; scheduledStart: string; }
interface ManagerLateReportEmailProps { managerName: string; managerEmail: string; lateStaff: LateStaffInfo[]; }
export async function sendManagerLateReportEmail({ managerName, managerEmail, lateStaff }: ManagerLateReportEmailProps): Promise<boolean> {
    try {
        if (!(await isEmailEnabled())) return true;
        
        const staffListHtml = lateStaff.map(s => `
            <div style="padding: 12px; border-bottom: 1px solid #f1f5f9;">
                <p style="margin: 0; font-weight: 700; color: #1e293b;">${s.name}</p>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;">Scheduled Start: ${s.scheduledStart}</p>
            </div>
        `).join('');

        const html = buildEmailHtml({
            title: `Staff Attendance Report`,
            subtitle: `Late Arrival Summary`,
            buttonText: 'View Dashboard',
            buttonLink: process.env.NEXTAUTH_URL || 'https://attendance-app-712513641417.us-central1.run.app',
            greetingName: managerName,
            bodyHtml: `
        <p>This is your daily report for staff members who haven't clocked in yet today (30+ minutes past their scheduled start):</p>
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin: 20px 0;">
            ${staffListHtml}
        </div>
        <p style="font-size: 14px; color: #64748b;">The system has already sent check-in reminders to each of these individuals.</p>
      `
        });
        
        const subject = lateStaff.length === 1 
            ? `[RSA] Late Arrival Alert: ${lateStaff[0].name}`
            : `[RSA] Late Arrival Report: ${lateStaff.length} Staff Members`;

        await transporter.sendMail({ from: SENDER_EMAIL, to: managerEmail, subject, html });
        return true;
    } catch (error) {
        console.error("[ZeptoMail] Failed to send manager late report email:", error);
        return false;
    }
}
