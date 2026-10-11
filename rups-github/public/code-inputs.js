// Keep six visible inputs compatible with typing, pasted codes and mobile autofill.
export function bindCodeInputs(elements) {
  const inputs = Array.from(elements);
  const focus = index => { inputs[index].focus({preventScroll:true}); inputs[index].select(); };
  function distribute(raw, index) {
    const digits = raw.replace(/\D/g, '').slice(0, inputs.length);
    if (!digits) { inputs[index].value = ''; return; }
    const start = digits.length === inputs.length ? 0 : index;
    for (let i = start; i < inputs.length && i - start < digits.length; i++) inputs[i].value = digits[i - start];
    focus(Math.min(start + digits.length, inputs.length - 1));
  }
  inputs.forEach((input, index) => {
    input.addEventListener('focus', () => input.select());
    input.addEventListener('input', () => distribute(input.value, index));
    input.addEventListener('paste', event => {
      event.preventDefault();
      distribute(event.clipboardData.getData('text'), index);
    });
    input.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && !input.value && index > 0) {
        event.preventDefault(); inputs[index - 1].value = ''; focus(index - 1);
      } else if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault(); focus(index - 1);
      } else if (event.key === 'ArrowRight' && index < inputs.length - 1) {
        event.preventDefault(); focus(index + 1);
      }
    });
  });
  return { value: () => inputs.map(input => input.value).join(''), focus: () => focus(0) };
}
