/**
 * Invoice email templates — lightweight inline-styled HTML that renders
 * well across Gmail/Outlook/Apple Mail without a framework.
 */

type InvoiceEmailData = {
  invoiceNumber: string
  businessName: string
  total: number
  dueDate: string
  periodStart: string
  periodEnd: string
  locationName: string
  paymentLink?: string
}

const fmtMoney = (n: number) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function baseLayout(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#151515;border:1px solid #262626;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid #262626;background:#1a1a1a;">
            <span style="font-size:14px;font-weight:600;letter-spacing:0.05em;color:#ff6b1a;">LV COURIERS</span>
          </td></tr>
          <tr><td style="padding:32px;">${body}</td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #262626;background:#1a1a1a;font-size:12px;color:#737373;text-align:center;">
            Questions? Reply to this email or contact billing@lv-couriers.local
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c] || c))
}

function detailsBlock(d: InvoiceEmailData) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #262626;border-radius:8px;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #262626;">
        <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Amount due</div>
        <div style="font-size:32px;font-weight:700;color:#fafafa;margin-top:4px;">${fmtMoney(d.total)}</div>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          <tr><td style="padding:4px 0;color:#a3a3a3;width:40%;">Invoice</td><td style="padding:4px 0;color:#fafafa;">${escapeHtml(d.invoiceNumber)}</td></tr>
          <tr><td style="padding:4px 0;color:#a3a3a3;">Period</td><td style="padding:4px 0;color:#fafafa;">${escapeHtml(fmtDate(d.periodStart))} – ${escapeHtml(fmtDate(d.periodEnd))}</td></tr>
          <tr><td style="padding:4px 0;color:#a3a3a3;">Location</td><td style="padding:4px 0;color:#fafafa;">${escapeHtml(d.locationName)}</td></tr>
          <tr><td style="padding:4px 0;color:#a3a3a3;">Due</td><td style="padding:4px 0;color:#fafafa;">${escapeHtml(fmtDate(d.dueDate))}</td></tr>
        </table>
      </td></tr>
    </table>
  `
}

// ---------- Templates ----------

export function invoiceSentEmail(d: InvoiceEmailData) {
  const subject = `Invoice ${d.invoiceNumber} from Lv Couriers - ${fmtMoney(d.total)}`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#fafafa;margin:0 0 12px;">New invoice for ${escapeHtml(d.businessName)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">Thank you for your business. Your invoice is attached below.</p>
    ${detailsBlock(d)}
    <p style="font-size:13px;line-height:1.5;color:#737373;margin:16px 0 0;">Please remit payment by <strong style="color:#fafafa;">${escapeHtml(fmtDate(d.dueDate))}</strong>.</p>
  `)
  const text = `New invoice for ${d.businessName}\n\nInvoice: ${d.invoiceNumber}\nPeriod: ${fmtDate(d.periodStart)} - ${fmtDate(d.periodEnd)}\nAmount Due: ${fmtMoney(d.total)}\nDue Date: ${fmtDate(d.dueDate)}\n\nPlease remit payment by ${fmtDate(d.dueDate)}.`
  return { subject, html, text }
}

export function invoiceReminderEmail(d: InvoiceEmailData, which: 1 | 2) {
  const friendly = which === 1 ? 'Friendly reminder' : 'Payment due soon'
  const subject = which === 1
    ? `Reminder: Invoice ${d.invoiceNumber} - ${fmtMoney(d.total)}`
    : `Invoice ${d.invoiceNumber} is due ${fmtDate(d.dueDate)}`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#fafafa;margin:0 0 12px;">${escapeHtml(friendly)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">${which === 1
      ? `Just a reminder that invoice ${escapeHtml(d.invoiceNumber)} is still outstanding.`
      : `Invoice ${escapeHtml(d.invoiceNumber)} is due on ${escapeHtml(fmtDate(d.dueDate))}. Please arrange payment to avoid late notices.`}</p>
    ${detailsBlock(d)}
  `)
  const text = `${friendly}\n\nInvoice ${d.invoiceNumber} for ${fmtMoney(d.total)} is due ${fmtDate(d.dueDate)}.`
  return { subject, html, text }
}

export function invoiceOverdueEmail(d: InvoiceEmailData) {
  const subject = `OVERDUE: Invoice ${d.invoiceNumber} - ${fmtMoney(d.total)}`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#ef4444;margin:0 0 12px;">Invoice overdue</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">Invoice <strong style="color:#fafafa;">${escapeHtml(d.invoiceNumber)}</strong> was due on ${escapeHtml(fmtDate(d.dueDate))} and is now past due. Please remit payment as soon as possible.</p>
    ${detailsBlock(d)}
    <p style="font-size:13px;line-height:1.5;color:#737373;margin:16px 0 0;">If payment has already been sent, please disregard this notice.</p>
  `)
  const text = `OVERDUE: Invoice ${d.invoiceNumber} for ${fmtMoney(d.total)} was due ${fmtDate(d.dueDate)} and is now past due.`
  return { subject, html, text }
}

export function invoiceEscalatedEmail(d: InvoiceEmailData) {
  const subject = `FINAL NOTICE: Invoice ${d.invoiceNumber}`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#dc2626;margin:0 0 12px;">Final notice</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">Invoice <strong style="color:#fafafa;">${escapeHtml(d.invoiceNumber)}</strong> has been escalated. Please contact us immediately to resolve this balance.</p>
    ${detailsBlock(d)}
  `)
  const text = `FINAL NOTICE: Invoice ${d.invoiceNumber} for ${fmtMoney(d.total)} has been escalated.`
  return { subject, html, text }
}
