const dialog = document.querySelector('#demo-dialog');
const form = document.querySelector('#demo-form');
const status = document.querySelector('#form-status');
let demoOpener;

function openDemo(event) {
  demoOpener = event.currentTarget;
  dialog.showModal();
  document.body.classList.add('modal-open');
  status.textContent = "";
}
document.querySelectorAll('[data-demo]').forEach(button => button.addEventListener('click', openDemo));
document.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.addEventListener('close', () => { document.body.classList.remove('modal-open'); demoOpener?.focus(); });
dialog.addEventListener('click', event => {
  const rect = dialog.getBoundingClientRect();
  if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
});

const verifyForm = document.createElement('form');
verifyForm.id = 'verify-form';
verifyForm.hidden = true;
verifyForm.innerHTML = '<p id="verification-email"></p><label>Email verification code<input name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required placeholder="Six-digit code"></label><p class="form-note">Your code expires in 10 minutes. Check your spam folder too.</p><button class="button" type="submit">Verify and request demo ↗</button><button type="button" id="resend-code" class="button">Send a new code</button><button type="button" id="edit-details" class="button">Edit details</button>';
form.after(verifyForm);
verifyForm.after(status);
let challengeId, pendingDetails, resendAt = 0, busy = false;
async function api(path, data) {
  const response = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  let result;
  try { result = await response.json(); } catch { throw new Error('Temporarily unavailable. Please email enquiries@rups.io.'); }
  if (!response.ok) throw new Error(result.error || 'Please try again.');
  return result;
}
async function sendCode() {
  const result = await api('/api/enquiries',pendingDetails);
  if (!result.verificationRequired) throw new Error('Unable to send verification code.');
  challengeId = result.challengeId;
  resendAt = Date.now()+60000;
  form.hidden = true; verifyForm.hidden = false;
  verifyForm.querySelector('#verification-email').textContent = 'Enter the code sent to '+pendingDetails.email+'.';
  verifyForm.reset(); verifyForm.elements.code.focus();
  status.textContent = 'Code sent. Confirm your email to finish your demo request.';
}
setInterval(()=>{
  const seconds=Math.max(0,Math.ceil((resendAt-Date.now())/1000));
  const resend=verifyForm.querySelector('#resend-code');
  resend.disabled=busy || seconds>0;
  resend.textContent=seconds ? `Resend in ${seconds}s` : 'Send a new code';
},1000);
verifyForm.querySelector('#edit-details').onclick=()=>{
  if(busy)return;
  verifyForm.hidden=true;form.hidden=false;challengeId=null;status.textContent='';form.elements.email.focus();
};
verifyForm.querySelector('#resend-code').onclick=async()=>{
  if(busy||Date.now()<resendAt)return;
  busy=true;
  try {await sendCode();} catch(error){status.textContent=error.message;}
  finally {busy=false;}
};
verifyForm.onsubmit=async event=>{
  event.preventDefault();if(busy||!verifyForm.reportValidity())return;
  busy=true;const button=verifyForm.querySelector('[type="submit"]');button.disabled=true;
  status.textContent='Verifying your email…';
  try {
    const result=await api('/api/enquiries/verify',{challengeId,code:verifyForm.elements.code.value});
    if(!result.saved)throw new Error('Unable to confirm your request.');
    form.reset();verifyForm.reset();verifyForm.hidden=true;form.hidden=false;
    pendingDetails=null;challengeId=null;
    status.textContent='Email verified — your request has been received. The Rups team will contact you to arrange your demo.';
  }catch(error){status.textContent=error.message;}
  finally {busy=false;button.disabled=false;}
};
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button=form.querySelector('[type="submit"]'); if(button.disabled)return;
  if(busy)return;
  button.disabled=true;busy=true;status.textContent='Sending your verification code…';
  try {
    pendingDetails=Object.fromEntries(new FormData(form));
    await sendCode();
  } catch(error) {status.textContent=error.message||'Unable to send. Please try again or email enquiries@rups.io.';}
  finally {button.disabled=false;busy=false;}
});
document.querySelector('#year').textContent = new Date().getFullYear();
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'start_demo_request',
      title: 'Open Rups demo request',
      description: 'Open the contact form for a Rups demo. Does not send details or book an appointment. The visitor must complete and submit the form.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length) throw new Error('Expected an empty object.');
        if (!dialog.open) openDemo({ currentTarget: document.querySelector('[data-demo]') });
        return { status: 'form_open', submitted: false };
      }
    }, { signal: lifecycle.signal })).catch(() => {});
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  } catch { /* The visible form works without WebMCP. */ }
}

function openFromLink(){if(location.hash==='#demo'&&!dialog.open)openDemo({currentTarget:document.querySelector('[data-demo]')});}
window.addEventListener('hashchange',openFromLink);
document.querySelectorAll('a[href="index.html#demo"]').forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  if (!dialog.open) openDemo(event);
}));
openFromLink();
