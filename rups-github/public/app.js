import { bindCodeInputs } from './code-inputs.js';

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
verifyForm.innerHTML = `
  <div class="verification-brand"><img src="assets/rups-logo.png" alt="Rups" width="88" height="88"></div>
  <p class="eyebrow blue">ONE LAST STEP</p>
  <h2 id="verification-title">Check your inbox.</h2>
  <p id="verification-email"></p>
  <fieldset class="code-fieldset"><legend>Enter your 6-digit code</legend>
    <div class="code-inputs">${Array.from({length:6},(_,i)=>`<input name="digit${i+1}" type="text" inputmode="numeric" autocomplete="${i===0?'one-time-code':'off'}" pattern="[0-9]" maxlength="6" required aria-label="Digit ${i+1} of 6" aria-describedby="code-help">`).join('')}</div>
  </fieldset>
  <p id="code-help" class="verification-help">Your code is valid for 10 minutes.<br>Can’t find it? Check your spam folder.</p>
  <button class="button verify-submit" type="submit">Verify email <span aria-hidden="true">↗</span></button>
  <div class="verification-actions"><button type="button" id="resend-code" class="text-button">Send a new code</button><span aria-hidden="true">·</span><button type="button" id="edit-details" class="text-button">Change email</button></div>
  <p class="verification-support">Need a hand? <a href="mailto:support@rups.io">Contact support</a></p>`;
form.after(verifyForm);
verifyForm.after(status);
const codeInputs = bindCodeInputs(verifyForm.querySelectorAll('.code-inputs input'));
function verificationMode(active) {
  dialog.classList.toggle('verification-mode', active);
  dialog.setAttribute('aria-labelledby', active ? 'verification-title' : 'demo-title');
  form.hidden = active;
  verifyForm.hidden = !active;
  dialog.scrollTop = 0;
}
let challengeId, pendingDetails, resendAt = 0, busy = false;
async function api(path, data) {
  const response = await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
  let result;
  try { result = await response.json(); } catch { throw new Error('Temporarily unavailable. Please email support@rups.io.'); }
  if (!response.ok) throw new Error(result.error || 'Please try again.');
  return result;
}
async function sendCode() {
  const result = await api('/api/enquiries',pendingDetails);
  if (!result.verificationRequired) throw new Error('Unable to send verification code.');
  challengeId = result.challengeId;
  resendAt = Date.now()+60000;
  verificationMode(true);
  verifyForm.querySelector('#verification-email').textContent = 'We sent a verification code to '+pendingDetails.email+'.';
  verifyForm.reset(); codeInputs.focus();
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
  verificationMode(false);challengeId=null;status.textContent='';form.elements.email.focus();
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
    const result=await api('/api/enquiries/verify',{challengeId,code:codeInputs.value()});
    if(!result.saved)throw new Error('Unable to confirm your request.');
    form.reset();verifyForm.reset();
    pendingDetails=null;challengeId=null;
    window.location.replace('demo-success.html');
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
  } catch(error) {status.textContent=error.message||'Unable to send. Please try again or email support@rups.io.';}
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
