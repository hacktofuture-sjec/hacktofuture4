const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendStatusEmail = async (userEmail, complaintTitle, status) => {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

    const mailOptions = {
      from: `"JanSetu Platform" <${process.env.EMAIL_USER}>`,
      to: userEmail,
      subject: `[Update] ${status}: ${complaintTitle}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
          <div style="background-color: #2563eb; padding: 20px; text-align: center; color: white;">
            <h2>JanSetu Civic Update</h2>
          </div>
          <div style="padding: 30px;">
            <p>Your report <strong>"${complaintTitle}"</strong> has a new update:</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border-left: 5px solid #3b82f6; font-size: 18px; font-weight: bold;">
               Status: ${status}
            </div>
            <p style="margin-top:20px; font-size: 14px; color: #64748b;">Thank you for your patience as we build a smarter city.</p>
          </div>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
  } catch (err) { console.error('Citizen Mail Failed:', err.message); }
};

const sendDepartmentAlert = async (deptEmail, complaint) => {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  
      const mailOptions = {
        from: `"JanSetu Alerts" <${process.env.EMAIL_USER}>`,
        to: deptEmail,
        subject: `🚨 [ACTION REQUIRED] New ${complaint.priority} Priority Task`,
        html: `
          <div style="font-family: sans-serif; border: 2px solid #ef4444; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #ef4444; padding: 20px; color: white; text-align: center;">
              <h3>Incoming Work Order: ${complaint.department}</h3>
            </div>
            <div style="padding: 30px;">
              <p>A new ${complaint.priority}-Priority civic complaint has been routed to your department.</p>
              <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                <tr><th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Title</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${complaint.title}</td></tr>
                <tr><th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Priority</th><td style="padding: 8px; border-bottom: 1px solid #ddd; color: red; font-weight: bold;">${complaint.priority}</td></tr>
                <tr><th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Deadline</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${new Date(complaint.deadline).toLocaleString()}</td></tr>
                <tr><th style="text-align: left; padding: 8px; border-bottom: 1px solid #ddd;">Location</th><td style="padding: 8px; border-bottom: 1px solid #ddd;">${complaint.location}</td></tr>
              </table>
              <p>Please initialize deployment and update status via the JanSetu Terminal.</p>
            </div>
          </div>
        `
      };
      await transporter.sendMail(mailOptions);
      console.log(`📡 Dept Alert sent to ${deptEmail}`);
    } catch (err) { console.error('Dept Mail Failed:', err.message); }
  };

const sendEscalationEmail = async (email, complaint, type = 'citizen') => {
    try {
      if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;
  
      const mailOptions = {
        from: `"JanSetu Escalation" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `⚠️ [ESCALATED] ${complaint.title}`,
        html: `
          <div style="font-family: sans-serif; border: 4px solid #f87171; border-radius: 12px; overflow: hidden; max-width: 600px; margin: auto;">
            <div style="background-color: #f87171; padding: 20px; color: white; text-align: center;">
              <h1>DEADLINE EXCEEDED</h1>
            </div>
            <div style="padding: 30px;">
              <p>The resolution deadline for report <strong>"${complaint.title}"</strong> has passed without resolution.</p>
              <div style="background: #fee2e2; padding: 15px; border-radius: 8px; color: #b91c1c; font-weight: bold;">
                Status: OVERDUE
              </div>
              <p style="margin-top: 20px;">${type === 'citizen' ? 'We apologize for the delay. The department head has been notified of this escalation.' : 'As the department in charge, please resolve this immediately to restore service levels.'}</p>
            </div>
          </div>
        `
      };
      await transporter.sendMail(mailOptions);
    } catch (err) { console.error('Escalation Mail Failed:', err.message); }
};

module.exports = { sendStatusEmail, sendDepartmentAlert, sendEscalationEmail };
