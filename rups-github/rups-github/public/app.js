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

let requestId=crypto.randomUUID();
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const button=form.querySelector('[type="submit"]'); if(button.disabled)return;
  button.disabled=true;status.textContent='Sending your request…';
  try {
    const response=await fetch('/api/enquiries',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...Object.fromEntries(new FormData(form)),id:requestId})});
    const result=await response.json();
    if(!response.ok||!result.saved)throw new Error(result.error||'Unable to save your request. Please try again.');
    form.reset();requestId=crypto.randomUUID();status.textContent='Thank you — your request has been received. The Rups team will contact you to arrange your demo.';
  } catch(error) {status.textContent=error.message||'Unable to send. Please try again or email enquiries@rups.io.';}
  finally {button.disabled=false;}
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
