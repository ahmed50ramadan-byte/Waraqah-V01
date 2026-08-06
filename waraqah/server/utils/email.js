const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('⚠️  GMAIL_USER أو GMAIL_APP_PASSWORD غير موجودين في .env - إرسال الإيميلات لن يعمل.');
    return null;
  }

  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  return transporter;
}

/**
 * يبعت إيميل إعادة تعيين كلمة السر لقارئ.
 */
async function sendPasswordResetEmail(toEmail, readerName, resetToken) {
  const t = getTransporter();
  if (!t) throw new Error('خدمة إرسال الإيميلات غير مُفعّلة على السيرفر حاليًا.');

  const resetUrl = `${process.env.PASSWORD_RESET_URL}?token=${resetToken}`;

  await t.sendMail({
    from: `"مجلة ورقة" <${process.env.GMAIL_USER}>`,
    to: toEmail,
    subject: 'إعادة تعيين كلمة السر - مجلة ورقة',
    html: `
      <div dir="rtl" style="font-family: Tahoma, Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="color: #b45309;">مرحبًا ${readerName}،</h2>
        <p style="color: #334155; line-height: 1.8;">وصلنا طلب لإعادة تعيين كلمة السر الخاصة بحسابك في مجلة ورقة. اضغط الزر تحت لاختيار كلمة سر جديدة:</p>
        <p style="text-align: center; margin: 28px 0;">
          <a href="${resetUrl}" style="background:#b45309; color:white; padding:12px 28px; border-radius:8px; text-decoration:none; font-weight:bold;">إعادة تعيين كلمة السر</a>
        </p>
        <p style="color: #94a3b8; font-size: 12px;">هذا الرابط صالح لمدة ساعة واحدة فقط. لو مش إنت اللي طلبت ده، تجاهل الرسالة دي ببساطة.</p>
      </div>
    `
  });
}

module.exports = { sendPasswordResetEmail };
