"use client";

// A message with Copy / Text it / Email it / Share buttons.
export default function MsgBox({ text, subject, onToast }) {
  const mailHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
  const smsHref = `sms:?&body=${encodeURIComponent(text)}`;

  async function copy() {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        onToast("Copied.");
      } else {
        onToast("Press and hold the text to copy.");
      }
    } catch {
      onToast("Press and hold the text to copy.");
    }
  }
  async function share() {
    try {
      if (navigator.share) await navigator.share({ text });
      else onToast("Sharing isn't available here. Use Copy or Text it.");
    } catch {
      /* cancelled */
    }
  }

  return (
    <div>
      <textarea className="msg" readOnly value={text} />
      <div className="btns">
        <button type="button" className="mini solid" onClick={copy}>Copy</button>
        <a className="mini" href={smsHref}>Text it</a>
        <a className="mini" href={mailHref}>Email it</a>
        <button type="button" className="mini" onClick={share}>Share…</button>
      </div>
    </div>
  );
}
