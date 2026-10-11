export function verificationEmail(code, origin) {
  const logo = new URL('/assets/rups-logo.png', origin).href.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  return {
    subject: 'Your Rups verification code',
    text: `Your Rups verification code is ${code}.\n\nIt expires in 10 minutes. Enter it on the Rups website to confirm your demo request.\n\nIf you did not request this code, ignore this email.\n\nNeed help? support@rups.io`,
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Your Rups verification code</title></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172329">
<div style="display:none;max-height:0;overflow:hidden">Your code is ${code}. Confirm your email to request a Rups demo.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:100%;max-width:480px;background:#ffffff;border-radius:24px"><tr><td align="center" style="padding:28px 24px 36px">
<img src="${logo}" alt="Rups" width="96" height="96" style="display:block;width:96px;height:96px;border:0;margin:0 auto">
<p style="font-size:11px;letter-spacing:2px;color:#0d73ff;margin:16px 0">ONE LAST STEP</p>
<h1 style="font-size:30px;line-height:1.15;font-weight:500;margin:0 0 18px">Your verification code.</h1>
<p style="font-size:15px;line-height:1.6;color:#57656e;margin:0">Enter this code on the Rups website<br>to confirm your demo request.</p>
<p style="font-size:36px;font-weight:700;letter-spacing:8px;color:#0d73ff;background:#eff5ff;border-radius:12px;padding:22px 10px;margin:28px 0">${code}</p>
<p style="font-size:13px;line-height:1.6;color:#57656e;margin:0">This code expires in 10 minutes.<br>If you didn’t request it, you can ignore this email.</p>
<p style="font-size:13px;margin:28px 0 0">Need a hand? <a href="mailto:support@rups.io" style="color:#0d73ff">Contact support</a></p>
</td></tr></table><p style="font-size:12px;color:#57656e">Rups · For the people behind every smile.</p>
</td></tr></table></body></html>`
  };
}
