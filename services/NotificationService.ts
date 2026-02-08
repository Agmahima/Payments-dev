const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

async function sendPaymentNotification({ user_id, payment_id, amount, currency, status }) {
  try {
    // Get user details from your user service
    const user = await getUserDetails(user_id);
    
    const subject = `Payment ${status} - ${payment_id}`;
    const message = `
      Dear ${user.name},
      
      Your payment of ${amount} ${currency} has been ${status.toLowerCase()}.
      Payment ID: ${payment_id}
      
      Thank you for your business!
      
      Best regards,
      Your Company Name
    `;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject,
      text: message
    });

    console.log(`Payment notification sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending payment notification:', error);
    // Don't throw error as notification failure shouldn't affect payment flow
  }
}

async function getUserDetails(userId) {
  // Implement your user service integration here
  // This is a placeholder - replace with actual user service call
  return {
    name: 'User Name',
    email: 'user@example.com'
  };
}

module.exports = {
  sendPaymentNotification
}; 