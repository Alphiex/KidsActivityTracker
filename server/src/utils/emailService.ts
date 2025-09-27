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
    const invitationUrl = `${this.baseUrl}/accept-invitation?token=${token}`;
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
}

export const emailService = new EmailService();