import nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export class EmailService {
  private transporter: Transporter;
  private readonly fromEmail: string;
  private readonly baseUrl: string;

  constructor() {
    // Initialize nodemailer transporter
    // For production, use real SMTP credentials
    // For development, you can use services like Mailtrap or Gmail
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
      }
    });

    this.fromEmail = process.env.FROM_EMAIL || 'noreply@kidsactivitytracker.com';
    this.baseUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  }

  /**
   * Send verification email
   */
  async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
    const verificationUrl = `${this.baseUrl}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Kids Activity Tracker!</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>Thank you for registering with Kids Activity Tracker. To complete your registration, please verify your email address by clicking the button below:</p>
            <center>
              <a href="${verificationUrl}" class="button">Verify Email Address</a>
            </center>
            <p>Or copy and paste this link into your browser:</p>
            <p>${verificationUrl}</p>
            <p>This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
            <p>Best regards,<br>The Kids Activity Tracker Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Verify your Kids Activity Tracker account',
      html
    });
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email: string, name: string, token: string): Promise<void> {
    const resetUrl = `${this.baseUrl}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .button { display: inline-block; padding: 10px 20px; background-color: #FF9800; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>We received a request to reset your password for your Kids Activity Tracker account. Click the button below to reset your password:</p>
            <center>
              <a href="${resetUrl}" class="button">Reset Password</a>
            </center>
            <p>Or copy and paste this link into your browser:</p>
            <p>${resetUrl}</p>
            <div class="warning">
              <strong>Important:</strong> This link will expire in 2 hours for security reasons.
            </div>
            <p>If you didn't request this password reset, you can safely ignore this email. Your password won't be changed.</p>
            <p>Best regards,<br>The Kids Activity Tracker Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Reset your Kids Activity Tracker password',
      html
    });
  }

  /**
   * Send password changed confirmation email
   */
  async sendPasswordChangedEmail(email: string, name: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .alert { background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 10px; margin: 10px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Changed Successfully</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>This email confirms that your password for Kids Activity Tracker has been successfully changed.</p>
            <p>The change was made on: <strong>${new Date().toLocaleString()}</strong></p>
            <div class="alert">
              <strong>Didn't make this change?</strong> If you didn't change your password, please contact our support team immediately and reset your password.
            </div>
            <p>For security reasons, we recommend:</p>
            <ul>
              <li>Using a unique password for each online account</li>
              <li>Enabling two-factor authentication when available</li>
              <li>Regularly updating your passwords</li>
            </ul>
            <p>Best regards,<br>The Kids Activity Tracker Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Your Kids Activity Tracker password has been changed',
      html
    });
  }

  /**
   * Send welcome email (after email verification)
   */
  async sendWelcomeEmail(email: string, name: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .feature { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Kids Activity Tracker!</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>Your email has been verified and your account is now active! We're excited to help you discover and manage activities for your children.</p>
            
            <h3>Here's what you can do:</h3>
            <div class="feature">
              <strong>🔍 Search Activities</strong>
              <p>Browse through hundreds of activities from local providers</p>
            </div>
            <div class="feature">
              <strong>👶 Manage Children Profiles</strong>
              <p>Add your children and track their activities and interests</p>
            </div>
            <div class="feature">
              <strong>⭐ Save Favorites</strong>
              <p>Keep track of activities you're interested in</p>
            </div>
            <div class="feature">
              <strong>👥 Share with Family</strong>
              <p>Share activity schedules with other caregivers</p>
            </div>
            
            <center>
              <a href="${this.baseUrl}/dashboard" class="button">Go to Dashboard</a>
            </center>
            
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br>The Kids Activity Tracker Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Welcome to Kids Activity Tracker!',
      html
    });
  }

  /**
   * Send generic email
   */
  private async sendEmail(options: EmailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        html: options.html
      });
      console.log(`Email sent successfully to ${options.to}`);
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send activity share invitation email
   */
  async sendActivityShareInvitation(
    recipientEmail: string,
    senderName: string,
    token: string,
    message?: string,
    expiresInDays: number = 7,
    recipientName?: string
  ): Promise<void> {
    // Use the deep link URL format that opens the app or falls back to web landing page
    const invitationUrl = `https://kidsactivitytracker.ca/invite/${token}`;
    const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #9C27B0; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .button { display: inline-block; padding: 12px 24px; background-color: #9C27B0; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .message-box { background-color: white; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #9C27B0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .warning { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Activity Share Invitation</h1>
          </div>
          <div class="content">
            <h2>${greeting}</h2>
            <p><strong>${senderName}</strong> would like to share their children's activity schedules with you on Kids Activity Tracker.</p>
            ${message ? `
            <div class="message-box">
              <strong>Personal message from ${senderName}:</strong>
              <p>${message}</p>
            </div>
            ` : ''}
            <p>By accepting this invitation, you'll be able to:</p>
            <ul>
              <li>View their children's activity schedules</li>
              <li>See upcoming activities and registrations</li>
              <li>Coordinate family activities together</li>
            </ul>
            <center>
              <a href="${invitationUrl}" class="button">Accept Invitation</a>
            </center>
            <p>Or copy and paste this link into your browser:</p>
            <p>${invitationUrl}</p>
            <div class="warning">
              <strong>Note:</strong> This invitation will expire in ${expiresInDays} days.
            </div>
            <p>If you don't have an account yet, you'll be prompted to create one when you accept the invitation.</p>
            <p>Best regards,<br>The Kids Activity Tracker Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: recipientEmail,
      subject: `${senderName} wants to share activities with you`,
      html
    });
  }

  /**
   * Send notification when share is accepted
   */
  async sendShareAcceptedNotification(
    recipientEmail: string,
    recipientName: string,
    acceptorName: string
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .success-box { background-color: #d4edda; border: 1px solid #c3e6cb; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invitation Accepted!</h1>
          </div>
          <div class="content">
            <h2>Hi ${recipientName},</h2>
            <div class="success-box">
              <strong>Great news!</strong> ${acceptorName} has accepted your activity sharing invitation.
            </div>
            <p>They can now view the activities for the children you've shared with them. You can manage these sharing settings at any time from your dashboard.</p>
            <center>
              <a href="${this.baseUrl}/dashboard/sharing" class="button">Manage Sharing Settings</a>
            </center>
            <p>Best regards,<br>The Kids Activity Tracker Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: recipientEmail,
      subject: `${acceptorName} accepted your sharing invitation`,
      html
    });
  }

  /**
   * Send notification when share is declined
   */
  async sendShareDeclinedNotification(
    recipientEmail: string,
    recipientName: string,
    declinerName: string
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .info-box { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Invitation Update</h1>
          </div>
          <div class="content">
            <h2>Hi ${recipientName},</h2>
            <div class="info-box">
              ${declinerName} has declined your activity sharing invitation.
            </div>
            <p>They won't be able to view your children's activities. You can send another invitation in the future if needed.</p>
            <p>Best regards,<br>The Kids Activity Tracker Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: recipientEmail,
      subject: `${declinerName} declined your sharing invitation`,
      html
    });
  }

  /**
   * Send notification when share is configured
   */
  async sendShareConfiguredNotification(
    recipientEmail: string,
    recipientName: string,
    sharerName: string,
    childrenNames: string[]
  ): Promise<void> {
    const childrenList = childrenNames.join(', ');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .info-box { background-color: #e3f2fd; border: 1px solid #90caf9; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #2196F3; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Activity Sharing Updated</h1>
          </div>
          <div class="content">
            <h2>Hi ${recipientName},</h2>
            <p>${sharerName} has updated their activity sharing settings with you.</p>
            <div class="info-box">
              <strong>Shared children:</strong> ${childrenList}
            </div>
            <p>You can now view activities for these children based on the permissions they've set.</p>
            <center>
              <a href="${this.baseUrl}/dashboard/shared" class="button">View Shared Activities</a>
            </center>
            <p>Best regards,<br>The Kids Activity Tracker Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: recipientEmail,
      subject: `${sharerName} updated activity sharing with you`,
      html
    });
  }

  /**
   * Send notification when share is revoked
   */
  async sendShareRevokedNotification(
    recipientEmail: string,
    recipientName: string,
    revokerName: string
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .alert-box { background-color: #ffebee; border: 1px solid #ffcdd2; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Activity Sharing Ended</h1>
          </div>
          <div class="content">
            <h2>Hi ${recipientName},</h2>
            <div class="alert-box">
              ${revokerName} has ended activity sharing with you.
            </div>
            <p>You will no longer be able to view their children's activities. If this was unexpected, you may want to reach out to them directly.</p>
            <p>Best regards,<br>The Kids Activity Tracker Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: recipientEmail,
      subject: `${revokerName} ended activity sharing`,
      html
    });
  }

  /**
   * Send account deleted confirmation email
   */
  async sendAccountDeletedEmail(email: string, name: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #607D8B; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
          .info-box { background-color: #e3f2fd; border: 1px solid #90caf9; padding: 15px; margin: 15px 0; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Account Deleted</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>This email confirms that your Kids Activity Tracker account has been successfully deleted.</p>
            <div class="info-box">
              <strong>What was deleted:</strong>
              <ul>
                <li>Your account profile</li>
                <li>All children profiles you added</li>
                <li>Your saved favorites</li>
                <li>Your sharing settings</li>
                <li>All associated preferences and data</li>
              </ul>
            </div>
            <p>If you didn't request this deletion, please contact our support team immediately.</p>
            <p>We're sorry to see you go. If you'd like to use Kids Activity Tracker again in the future, you're welcome to create a new account anytime.</p>
            <p>Best regards,<br>The Kids Activity Tracker Team</p>
          </div>
          <div class="footer">
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: email,
      subject: 'Your Kids Activity Tracker account has been deleted',
      html
    });
  }

  /**
   * Send daily digest email with new activities matching user preferences
   */
  async sendDailyDigest(
    user: { name: string; email: string },
    activities: Array<{
      id: string;
      name: string;
      description?: string | null;
      cost?: number;
      spotsAvailable?: number | null;
      dayOfWeek?: string[];
      startTime?: string | null;
      endTime?: string | null;
      ageMin?: number | null;
      ageMax?: number | null;
      registrationUrl?: string | null;
      provider?: { name: string } | null;
      location?: { name: string; city: string } | null;
    }>,
    unsubscribeUrl: string
  ): Promise<void> {
    const activityCardsHtml = activities.slice(0, 10).map(activity => {
      const price = activity.cost ? `$${activity.cost.toFixed(2)}` : 'Free';
      const spots = activity.spotsAvailable !== null && activity.spotsAvailable !== undefined
        ? `${activity.spotsAvailable} spots left`
        : '';
      const days = activity.dayOfWeek?.join(', ') || '';
      const time = activity.startTime && activity.endTime
        ? `${activity.startTime} - ${activity.endTime}`
        : activity.startTime || '';
      const ages = activity.ageMin !== null && activity.ageMax !== null
        ? `Ages ${activity.ageMin}-${activity.ageMax}`
        : '';
      const location = activity.location
        ? `${activity.location.name}, ${activity.location.city}`
        : '';

      return `
        <div style="background: white; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
          <h3 style="margin: 0 0 8px 0; color: #222;">${activity.name}</h3>
          <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${activity.provider?.name || 'Provider'}</p>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 12px;">
            ${ages ? `<span style="background: #FFE5EC; color: #FF385C; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${ages}</span>` : ''}
            ${days ? `<span style="background: #E3F2FD; color: #1976D2; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${days}</span>` : ''}
            ${time ? `<span style="background: #F3E5F5; color: #7B1FA2; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${time}</span>` : ''}
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: bold; color: #222;">${price}</span>
              ${spots ? `<span style="margin-left: 12px; color: ${activity.spotsAvailable && activity.spotsAvailable <= 3 ? '#FF385C' : '#666'}; font-size: 14px;">${spots}</span>` : ''}
            </div>
            <a href="${activity.registrationUrl || this.baseUrl}" style="background: #FF385C; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 14px;">View Details</a>
          </div>
          ${location ? `<p style="margin: 12px 0 0 0; color: #888; font-size: 12px;">📍 ${location}</p>` : ''}
        </div>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #FF385C 0%, #FF6B6B 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
          .header h1 { margin: 0; font-size: 24px; }
          .header p { margin: 8px 0 0 0; opacity: 0.9; }
          .content { background: #f9f9f9; padding: 24px; border-radius: 0 0 12px 12px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
          .footer a { color: #FF385C; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎯 ${activities.length} New Activities for You!</h1>
            <p>Based on your preferences</p>
          </div>
          <div class="content">
            <p style="margin: 0 0 20px 0;">Hi ${user.name},</p>
            <p style="margin: 0 0 20px 0;">We found <strong>${activities.length} new activities</strong> that match what you're looking for:</p>
            ${activityCardsHtml}
            ${activities.length > 10 ? `<p style="text-align: center; color: #666;">+ ${activities.length - 10} more activities in the app</p>` : ''}
            <div style="text-align: center; margin-top: 24px;">
              <a href="${this.baseUrl}" style="background: #FF385C; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Browse All Activities</a>
            </div>
          </div>
          <div class="footer">
            <p>You're receiving this because you enabled daily activity alerts.</p>
            <p><a href="${unsubscribeUrl}">Unsubscribe</a> | <a href="${this.baseUrl}/settings/notifications">Manage Preferences</a></p>
            <p>Kids Activity Tracker</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: user.email,
      subject: `🎯 ${activities.length} New Activities Match Your Preferences`,
      html
    });
  }

  /**
   * Send weekly digest summary email
   */
  async sendWeeklyDigest(
    user: { name: string; email: string },
    summary: {
      newActivitiesCount: number;
      topActivities: Array<{
        id: string;
        name: string;
        cost?: number;
        provider?: { name: string } | null;
        location?: { name: string; city: string } | null;
      }>;
      favoritesCount: number;
      weekStart: Date;
      weekEnd: Date;
    },
    unsubscribeUrl: string
  ): Promise<void> {
    const weekRange = `${summary.weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${summary.weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

    const topActivitiesHtml = summary.topActivities.slice(0, 5).map(activity => `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px 8px;">
          <strong style="color: #222;">${activity.name}</strong><br>
          <span style="color: #666; font-size: 13px;">${activity.provider?.name || ''}</span>
        </td>
        <td style="padding: 12px 8px; text-align: right; color: #FF385C; font-weight: 600;">
          ${activity.cost ? `$${activity.cost}` : 'Free'}
        </td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: white; padding: 24px; border-radius: 0 0 12px 12px; }
          .stat-box { background: #f9f9f9; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px; }
          .stat-number { font-size: 36px; font-weight: bold; color: #FF385C; }
          .stat-label { color: #666; font-size: 14px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
          .footer a { color: #667eea; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Your Weekly Activity Digest</h1>
            <p>${weekRange}</p>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>Here's your weekly summary of kids' activities:</p>

            <div style="display: flex; gap: 16px; margin: 24px 0;">
              <div class="stat-box" style="flex: 1;">
                <div class="stat-number">${summary.newActivitiesCount}</div>
                <div class="stat-label">New Activities</div>
              </div>
              <div class="stat-box" style="flex: 1;">
                <div class="stat-number">${summary.favoritesCount}</div>
                <div class="stat-label">Your Favorites</div>
              </div>
            </div>

            <h3 style="color: #222; margin: 24px 0 16px 0;">Top Activities This Week</h3>
            <table style="width: 100%; border-collapse: collapse;">
              ${topActivitiesHtml}
            </table>

            <div style="text-align: center; margin-top: 32px;">
              <a href="${this.baseUrl}" style="background: #667eea; color: white; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Explore Activities</a>
            </div>
          </div>
          <div class="footer">
            <p>You're receiving this weekly digest based on your preferences.</p>
            <p><a href="${unsubscribeUrl}">Unsubscribe</a> | <a href="${this.baseUrl}/settings/notifications">Manage Preferences</a></p>
            <p>Kids Activity Tracker</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: user.email,
      subject: `📊 Weekly Digest: ${summary.newActivitiesCount} New Activities (${weekRange})`,
      html
    });
  }

  /**
   * Send capacity alert when a favorited activity is running low on spots
   */
  async sendCapacityAlert(
    user: { name: string; email: string },
    activity: {
      name: string;
      spotsAvailable?: number | null;
      totalSpots?: number | null;
      cost?: number;
      dayOfWeek?: string[];
      startTime?: string | null;
      registrationUrl?: string | null;
      provider?: { name: string } | null;
      location?: { name: string; city: string } | null;
    },
    spotsRemaining: number,
    unsubscribeUrl: string
  ): Promise<void> {
    const urgencyColor = spotsRemaining <= 1 ? '#D32F2F' : spotsRemaining <= 3 ? '#F57C00' : '#FF385C';
    const days = activity.dayOfWeek?.join(', ') || '';
    const location = activity.location ? `${activity.location.name}, ${activity.location.city}` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${urgencyColor}; color: white; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: white; padding: 24px; border-radius: 0 0 12px 12px; }
          .alert-box { background: #FFF3E0; border: 2px solid ${urgencyColor}; border-radius: 8px; padding: 16px; text-align: center; margin: 20px 0; }
          .spots-remaining { font-size: 48px; font-weight: bold; color: ${urgencyColor}; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
          .footer a { color: #FF385C; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Spots Filling Up Fast!</h1>
            <p>One of your saved activities is almost full</p>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>An activity you saved is running low on spots:</p>

            <div class="alert-box">
              <div class="spots-remaining">${spotsRemaining}</div>
              <div style="color: #666; font-size: 16px;">spot${spotsRemaining !== 1 ? 's' : ''} remaining${activity.totalSpots ? ` out of ${activity.totalSpots}` : ''}</div>
            </div>

            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin: 0 0 12px 0; color: #222;">${activity.name}</h3>
              <p style="margin: 0 0 8px 0; color: #666;">${activity.provider?.name || 'Provider'}</p>
              ${days ? `<p style="margin: 0 0 4px 0; color: #666;">📅 ${days}${activity.startTime ? ` at ${activity.startTime}` : ''}</p>` : ''}
              ${location ? `<p style="margin: 0 0 4px 0; color: #666;">📍 ${location}</p>` : ''}
              <p style="margin: 12px 0 0 0;"><strong style="color: #222;">${activity.cost ? `$${activity.cost}` : 'Free'}</strong></p>
            </div>

            <div style="text-align: center; margin-top: 24px;">
              <a href="${activity.registrationUrl || this.baseUrl}" style="background: ${urgencyColor}; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">Register Now</a>
            </div>

            <p style="text-align: center; color: #888; margin-top: 16px; font-size: 14px;">Don't miss out - register before it fills up!</p>
          </div>
          <div class="footer">
            <p>You're receiving this because you enabled capacity alerts for saved activities.</p>
            <p><a href="${unsubscribeUrl}">Unsubscribe</a> | <a href="${this.baseUrl}/settings/notifications">Manage Preferences</a></p>
            <p>Kids Activity Tracker</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: user.email,
      subject: `⚠️ ${activity.name} - Only ${spotsRemaining} Spot${spotsRemaining !== 1 ? 's' : ''} Left!`,
      html
    });
  }

  /**
   * Send price drop alert when a favorited activity's price decreases
   */
  async sendPriceDropAlert(
    user: { name: string; email: string },
    activity: {
      name: string;
      cost?: number;
      dayOfWeek?: string[];
      startTime?: string | null;
      registrationUrl?: string | null;
      provider?: { name: string } | null;
      location?: { name: string; city: string } | null;
    },
    oldPrice: number,
    newPrice: number,
    unsubscribeUrl: string
  ): Promise<void> {
    const savings = oldPrice - newPrice;
    const savingsPercent = Math.round((savings / oldPrice) * 100);
    const days = activity.dayOfWeek?.join(', ') || '';
    const location = activity.location ? `${activity.location.name}, ${activity.location.city}` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #00C853 0%, #00E676 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: white; padding: 24px; border-radius: 0 0 12px 12px; }
          .price-box { background: #E8F5E9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .old-price { font-size: 24px; color: #888; text-decoration: line-through; }
          .new-price { font-size: 42px; font-weight: bold; color: #00C853; }
          .savings { background: #00C853; color: white; padding: 4px 12px; border-radius: 20px; font-size: 14px; display: inline-block; margin-top: 8px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
          .footer a { color: #00C853; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 Price Drop Alert!</h1>
            <p>Great news - an activity you're watching just got cheaper</p>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>The price just dropped on an activity you saved:</p>

            <div class="price-box">
              <div class="old-price">$${oldPrice.toFixed(2)}</div>
              <div class="new-price">$${newPrice.toFixed(2)}</div>
              <div class="savings">Save $${savings.toFixed(2)} (${savingsPercent}% off)</div>
            </div>

            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin: 0 0 12px 0; color: #222;">${activity.name}</h3>
              <p style="margin: 0 0 8px 0; color: #666;">${activity.provider?.name || 'Provider'}</p>
              ${days ? `<p style="margin: 0 0 4px 0; color: #666;">📅 ${days}${activity.startTime ? ` at ${activity.startTime}` : ''}</p>` : ''}
              ${location ? `<p style="margin: 0; color: #666;">📍 ${location}</p>` : ''}
            </div>

            <div style="text-align: center; margin-top: 24px;">
              <a href="${activity.registrationUrl || this.baseUrl}" style="background: #00C853; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">Register at New Price</a>
            </div>
          </div>
          <div class="footer">
            <p>You're receiving this because you enabled price drop alerts.</p>
            <p><a href="${unsubscribeUrl}">Unsubscribe</a> | <a href="${this.baseUrl}/settings/notifications">Manage Preferences</a></p>
            <p>Kids Activity Tracker</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: user.email,
      subject: `💰 Price Drop: ${activity.name} Now $${newPrice.toFixed(2)} (Save ${savingsPercent}%)`,
      html
    });
  }

  /**
   * Send spots available alert for waitlisted activities
   */
  async sendSpotsAvailableAlert(
    user: { name: string; email: string },
    activity: {
      name: string;
      spotsAvailable?: number | null;
      cost?: number;
      dayOfWeek?: string[];
      startTime?: string | null;
      registrationUrl?: string | null;
      provider?: { name: string } | null;
      location?: { name: string; city: string } | null;
    },
    unsubscribeUrl: string
  ): Promise<void> {
    const days = activity.dayOfWeek?.join(', ') || '';
    const location = activity.location ? `${activity.location.name}, ${activity.location.city}` : '';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2196F3 0%, #03A9F4 100%); color: white; padding: 30px 20px; text-align: center; border-radius: 12px 12px 0 0; }
          .content { background: white; padding: 24px; border-radius: 0 0 12px 12px; }
          .alert-box { background: #E3F2FD; border: 2px solid #2196F3; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
          .checkmark { font-size: 48px; margin-bottom: 8px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #888; }
          .footer a { color: #2196F3; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Spots Now Available!</h1>
            <p>An activity you were waiting for has openings</p>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>Great news! An activity you joined the waitlist for now has spots available:</p>

            <div class="alert-box">
              <div class="checkmark">✅</div>
              <div style="font-size: 18px; font-weight: 600; color: #1565C0;">${activity.spotsAvailable} spot${activity.spotsAvailable !== 1 ? 's' : ''} now available!</div>
            </div>

            <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin: 0 0 12px 0; color: #222;">${activity.name}</h3>
              <p style="margin: 0 0 8px 0; color: #666;">${activity.provider?.name || 'Provider'}</p>
              ${days ? `<p style="margin: 0 0 4px 0; color: #666;">📅 ${days}${activity.startTime ? ` at ${activity.startTime}` : ''}</p>` : ''}
              ${location ? `<p style="margin: 0 0 4px 0; color: #666;">📍 ${location}</p>` : ''}
              <p style="margin: 12px 0 0 0;"><strong style="color: #222;">${activity.cost ? `$${activity.cost}` : 'Free'}</strong></p>
            </div>

            <div style="text-align: center; margin-top: 24px;">
              <a href="${activity.registrationUrl || this.baseUrl}" style="background: #2196F3; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 16px;">Register Now</a>
            </div>

            <p style="text-align: center; color: #888; margin-top: 16px; font-size: 14px;">Act fast - these spots may fill up quickly!</p>
          </div>
          <div class="footer">
            <p>You're receiving this because you joined the waitlist for this activity.</p>
            <p><a href="${unsubscribeUrl}">Unsubscribe</a> | <a href="${this.baseUrl}/settings/notifications">Manage Preferences</a></p>
            <p>Kids Activity Tracker</p>
          </div>
        </div>
      </body>
      </html>
    `;

    await this.sendEmail({
      to: user.email,
      subject: `🎉 Spots Available: ${activity.name}`,
      html
    });
  }

  /**
   * Verify transporter connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      console.log('Email service is ready');
      return true;
    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  }

  /**
   * Send scraper health digest email
   */
  async sendScraperDigest(options: {
    to: string[];
    alerts: Array<{
      providerName: string;
      providerCode: string;
      alertReason: string;
      currentCount: number;
      previousCount: number | null;
      currentCoverage: number | null;
      previousCoverage: number | null;
      fieldCoverage: Record<string, number> | null;
      timestamp: Date;
    }>;
    date?: Date;
  }): Promise<void> {
    const digestDate = options.date || new Date();
    const dateStr = digestDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Build alert rows HTML
    let alertRowsHtml = '';
    options.alerts.forEach((alert, index) => {
      const isCountAlert = alert.alertReason.includes('activity_count');
      const isCoverageAlert = alert.alertReason.includes('coverage');

      let alertDetails = '';
      if (isCountAlert && alert.previousCount !== null) {
        const changePercent = ((alert.currentCount - alert.previousCount) / alert.previousCount * 100).toFixed(1);
        const changeSign = Number(changePercent) >= 0 ? '+' : '';
        alertDetails = `
          <strong>Activity Count Change</strong><br>
          Previous: ${alert.previousCount} activities → Current: ${alert.currentCount} activities<br>
          Change: ${changeSign}${changePercent}% (threshold: ±20%)
        `;
      }

      if (isCoverageAlert) {
        // Find fields below 90%
        const lowFields: string[] = [];
        if (alert.fieldCoverage) {
          Object.entries(alert.fieldCoverage).forEach(([field, pct]) => {
            if (field !== 'average' && typeof pct === 'number' && pct < 90) {
              lowFields.push(`${field} (${pct}%)`);
            }
          });
        }
        const fieldsStr = lowFields.length > 0 ? lowFields.join(', ') : 'N/A';
        alertDetails += (alertDetails ? '<br><br>' : '') + `
          <strong>Field Coverage Drop</strong><br>
          Previous: ${alert.previousCoverage?.toFixed(0) || 'N/A'}% → Current: ${alert.currentCoverage?.toFixed(0)}%<br>
          Fields affected: ${fieldsStr}
        `;
      }

      alertRowsHtml += `
        <tr style="border-bottom: 1px solid #e0e0e0;">
          <td style="padding: 15px; vertical-align: top;">
            <strong>${index + 1}. ${alert.providerName}</strong><br>
            <span style="color: #666; font-size: 12px;">${alert.providerCode}</span>
          </td>
          <td style="padding: 15px; vertical-align: top;">
            ${alertDetails}
          </td>
          <td style="padding: 15px; vertical-align: top; color: #666; font-size: 12px;">
            ${alert.timestamp.toLocaleString()}
          </td>
        </tr>
      `;
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
          .container { max-width: 800px; margin: 0 auto; padding: 20px; }
          .header { background-color: #FF5722; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f4f4f4; }
          .alert-table { width: 100%; border-collapse: collapse; background-color: white; margin: 20px 0; }
          .alert-table th { background-color: #f5f5f5; padding: 12px; text-align: left; border-bottom: 2px solid #e0e0e0; }
          .summary-box { background-color: #fff3e0; border: 1px solid #ffcc80; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Scraper Health Digest</h1>
            <p>${dateStr}</p>
          </div>
          <div class="content">
            <div class="summary-box">
              <strong>⚠️ ${options.alerts.length} provider(s) require attention</strong>
            </div>

            <table class="alert-table">
              <thead>
                <tr>
                  <th style="width: 25%;">Provider</th>
                  <th style="width: 50%;">Issue Details</th>
                  <th style="width: 25%;">Time</th>
                </tr>
              </thead>
              <tbody>
                ${alertRowsHtml}
              </tbody>
            </table>

            <p><strong>Action Required:</strong> Please investigate the affected scrapers or source websites.</p>

            <p style="font-size: 12px; color: #666; margin-top: 30px;">
              Thresholds: Activity count change > ±20%, Field coverage < 90%
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message from Kids Activity Tracker scraper monitoring.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to each recipient
    for (const recipient of options.to) {
      await this.sendEmail({
        to: recipient,
        subject: `📊 Scraper Health Digest - ${dateStr} (${options.alerts.length} issue${options.alerts.length !== 1 ? 's' : ''})`,
        html
      });
    }
  }
}

export const emailService = new EmailService();