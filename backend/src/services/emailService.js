const nodemailer = require('nodemailer');

/**
 * Creates a nodemailer transporter if credentials are present,
 * otherwise returns null for mock console output fallback.
 */
function createTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD;

  if (user && pass) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass
      }
    });
  }
  return null;
}

/**
 * Sends an email or prints mock email to console if SMTP credentials are missing.
 * @param {Object} options - { to, subject, html, text }
 * @returns {Promise<{ success: boolean, messageId?: string, error?: string }>}
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = createTransporter();

  if (!transporter) {
    console.log('\n======================================================');
    console.log(' [MOCK EMAIL SERVICE] SMTP Credentials not configured in .env');
    console.log(` To:      ${to}`);
    console.log(` Subject: ${subject}`);
    console.log('------------------------------------------------------');
    console.log(text || html);
    console.log('======================================================\n');
    return { success: true, messageId: `mock-${Date.now()}` };
  }

  try {
    const info = await transporter.sendMail({
      from: `"PharmaGuard Alerts" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || '',
      html
    });
    console.log(`[EmailService] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EmailService] Failed to send email to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generates an attractive, clinical HTML digest email table
 * @param {string} title
 * @param {string} description
 * @param {Array<{ name: string, batch_id: string, quantity: number, expiry_date: string, days_left?: number }>} items
 * @param {'LOW_STOCK' | 'EXPIRY' | 'EXPIRED'} type
 */
function generateDigestEmailHtml({ title, description, items, type }) {
  const badgeColor = type === 'EXPIRED' ? '#DC2626' : (type === 'LOW_STOCK' ? '#EA580C' : '#D97706');
  const badgeBg = type === 'EXPIRED' ? '#FEE2E2' : (type === 'LOW_STOCK' ? '#FFEDD5' : '#FEF3C7');

  const rows = items.map((item, idx) => {
    const daysLabel = item.days_left !== undefined 
      ? (item.days_left < 0 ? `${Math.abs(item.days_left)} days overdue` : `${item.days_left} days`)
      : 'N/A';

    return `
      <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'}; border-bottom: 1px solid #E2E8F0;">
        <td style="padding: 12px 14px; font-weight: 600; color: #0F172A;">${item.name}</td>
        <td style="padding: 12px 14px; font-family: monospace; color: #475569;">${item.batch_id}</td>
        <td style="padding: 12px 14px; color: #0F172A; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px 14px; color: #475569;">${item.expiry_date}</td>
        <td style="padding: 12px 14px; color: ${badgeColor}; font-weight: 600; text-align: center;">${daysLabel}</td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${title}</title>
    </head>
    <body style="margin: 0; padding: 24px; background-color: #F7FAFC; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0F172A;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 650px; background-color: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
        <!-- Header -->
        <tr>
          <td style="background-color: #0F766E; padding: 20px 24px; color: #FFFFFF;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td>
                  <h1 style="margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.02em;">PharmaGuard</h1>
                  <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Pharmacy Expiry & Stock Safety Alert</p>
                </td>
                <td align="right">
                  <span style="background-color: ${badgeBg}; color: ${badgeColor}; padding: 6px 12px; border-radius: 9999px; font-size: 12px; font-weight: 700; text-transform: uppercase;">
                    ${type}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding: 24px;">
            <h2 style="margin: 0 0 8px 0; font-size: 18px; color: #0F172A;">${title}</h2>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.5;">${description}</p>

            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #E2E8F0; border-radius: 8px; overflow: hidden; font-size: 14px;">
              <thead>
                <tr style="background-color: #F1F5F9; border-bottom: 2px solid #CBD5E1;">
                  <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Medicine</th>
                  <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Batch ID</th>
                  <th style="padding: 10px 14px; text-align: center; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Qty</th>
                  <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Expiry Date</th>
                  <th style="padding: 10px 14px; text-align: center; font-size: 12px; font-weight: 700; color: #475569; text-transform: uppercase;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>

            <div style="margin-top: 24px; padding: 14px 16px; background-color: #F8FAFC; border-left: 4px solid #0F766E; border-radius: 4px; font-size: 13px; color: #475569;">
              <strong>Action required:</strong> Please update your physical shelves or place a restock order in PharmaGuard to clear this alert.
            </div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color: #F8FAFC; padding: 16px 24px; border-top: 1px solid #E2E8F0; font-size: 12px; color: #64748B; text-align: center;">
            This is an automated notification from PharmaGuard.
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

module.exports = {
  sendEmail,
  generateDigestEmailHtml
};
