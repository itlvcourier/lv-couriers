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

export type CompanySettings = {
  companyName: string
  companyAddress: string
  companyPhone: string
  companyEmail: string
  taxNumber: string
  taxLabel: string
  taxRate: number
  paymentTerms: string
  paymentInstructions: string
  bankName: string
  bankAccountName: string
  bankAccountNumber: string
  bankTransitNumber: string
  bankInstitutionNumber: string
  footerNotes: string
}

export const defaultCompanySettings: CompanySettings = {
  companyName: 'LV Couriers',
  companyAddress: '',
  companyPhone: '',
  companyEmail: 'billing@lv-couriers.local',
  taxNumber: '',
  taxLabel: 'GST',
  taxRate: 5,
  paymentTerms: 'Net 15',
  paymentInstructions: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNumber: '',
  bankTransitNumber: '',
  bankInstitutionNumber: '',
  footerNotes: '',
}

const fmtMoney = (n: number) =>
  n.toLocaleString('en-CA', { style: 'currency', currency: 'CAD' })

const fmtDate = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function baseLayout(title: string, body: string, company: CompanySettings = defaultCompanySettings) {
  const companyHeader = company.companyName || 'LV COURIERS'
  const footerEmail = company.companyEmail || 'billing@lv-couriers.local'
  
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e5e5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:32px 16px;">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#151515;border:1px solid #262626;border-radius:12px;overflow:hidden;">
          <tr><td style="padding:24px 32px;border-bottom:1px solid #262626;background:#1a1a1a;">
            <span style="font-size:14px;font-weight:600;letter-spacing:0.05em;color:#ff6b1a;">${escapeHtml(companyHeader.toUpperCase())}</span>
            ${company.companyAddress ? `<div style="font-size:11px;color:#737373;margin-top:4px;">${escapeHtml(company.companyAddress)}</div>` : ''}
            ${company.companyPhone ? `<div style="font-size:11px;color:#737373;">${escapeHtml(company.companyPhone)}</div>` : ''}
            ${company.taxNumber ? `<div style="font-size:11px;color:#737373;">${escapeHtml(company.taxLabel)} #: ${escapeHtml(company.taxNumber)}</div>` : ''}
          </td></tr>
          <tr><td style="padding:32px;">${body}</td></tr>
          <tr><td style="padding:20px 32px;border-top:1px solid #262626;background:#1a1a1a;font-size:12px;color:#737373;text-align:center;">
            ${company.footerNotes ? `<div style="margin-bottom:8px;">${escapeHtml(company.footerNotes)}</div>` : ''}
            Questions? Reply to this email or contact ${escapeHtml(footerEmail)}
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

function detailsBlock(d: InvoiceEmailData, company: CompanySettings = defaultCompanySettings) {
  const paymentSection = (company.bankName || company.paymentInstructions) ? `
    <tr><td style="padding:16px 20px;border-top:1px solid #262626;">
      <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:8px;">Payment Information</div>
      ${company.paymentInstructions ? `<div style="font-size:13px;color:#a3a3a3;margin-bottom:8px;">${escapeHtml(company.paymentInstructions)}</div>` : ''}
      ${company.bankName ? `
        <table style="font-size:13px;color:#fafafa;">
          <tr><td style="padding:2px 12px 2px 0;color:#a3a3a3;">Bank:</td><td>${escapeHtml(company.bankName)}</td></tr>
          ${company.bankAccountName ? `<tr><td style="padding:2px 12px 2px 0;color:#a3a3a3;">Account Name:</td><td>${escapeHtml(company.bankAccountName)}</td></tr>` : ''}
          ${company.bankAccountNumber ? `<tr><td style="padding:2px 12px 2px 0;color:#a3a3a3;">Account #:</td><td>${escapeHtml(company.bankAccountNumber)}</td></tr>` : ''}
          ${company.bankTransitNumber ? `<tr><td style="padding:2px 12px 2px 0;color:#a3a3a3;">Transit #:</td><td>${escapeHtml(company.bankTransitNumber)}</td></tr>` : ''}
          ${company.bankInstitutionNumber ? `<tr><td style="padding:2px 12px 2px 0;color:#a3a3a3;">Institution #:</td><td>${escapeHtml(company.bankInstitutionNumber)}</td></tr>` : ''}
        </table>
      ` : ''}
    </td></tr>
  ` : ''
  
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
          <tr><td style="padding:4px 0;color:#a3a3a3;">Terms</td><td style="padding:4px 0;color:#fafafa;">${escapeHtml(company.paymentTerms || 'Net 15')}</td></tr>
        </table>
      </td></tr>
      ${paymentSection}
    </table>
  `
}

// ---------- Templates ----------

export function invoiceSentEmail(d: InvoiceEmailData, company: CompanySettings = defaultCompanySettings) {
  const companyName = company.companyName || 'Lv Couriers'
  const subject = `Invoice ${d.invoiceNumber} from ${companyName} - ${fmtMoney(d.total)}`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#fafafa;margin:0 0 12px;">New invoice for ${escapeHtml(d.businessName)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">Thank you for your business. Your invoice is attached below.</p>
    ${detailsBlock(d, company)}
    <p style="font-size:13px;line-height:1.5;color:#737373;margin:16px 0 0;">Please remit payment by <strong style="color:#fafafa;">${escapeHtml(fmtDate(d.dueDate))}</strong>.</p>
  `, company)
  const text = `New invoice for ${d.businessName}\n\nInvoice: ${d.invoiceNumber}\nPeriod: ${fmtDate(d.periodStart)} - ${fmtDate(d.periodEnd)}\nAmount Due: ${fmtMoney(d.total)}\nDue Date: ${fmtDate(d.dueDate)}\n\nPlease remit payment by ${fmtDate(d.dueDate)}.`
  return { subject, html, text }
}

export function invoiceReminderEmail(d: InvoiceEmailData, which: 1 | 2, company: CompanySettings = defaultCompanySettings) {
  const friendly = which === 1 ? 'Friendly reminder' : 'Payment due soon'
  const subject = which === 1
    ? `Reminder: Invoice ${d.invoiceNumber} - ${fmtMoney(d.total)}`
    : `Invoice ${d.invoiceNumber} is due ${fmtDate(d.dueDate)}`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#fafafa;margin:0 0 12px;">${escapeHtml(friendly)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">${which === 1
      ? `Just a reminder that invoice ${escapeHtml(d.invoiceNumber)} is still outstanding.`
      : `Invoice ${escapeHtml(d.invoiceNumber)} is due on ${escapeHtml(fmtDate(d.dueDate))}. Please arrange payment to avoid late notices.`}</p>
    ${detailsBlock(d, company)}
  `, company)
  const text = `${friendly}\n\nInvoice ${d.invoiceNumber} for ${fmtMoney(d.total)} is due ${fmtDate(d.dueDate)}.`
  return { subject, html, text }
}

export function invoiceOverdueEmail(d: InvoiceEmailData, company: CompanySettings = defaultCompanySettings) {
  const subject = `OVERDUE: Invoice ${d.invoiceNumber} - ${fmtMoney(d.total)}`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#ef4444;margin:0 0 12px;">Invoice overdue</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">Invoice <strong style="color:#fafafa;">${escapeHtml(d.invoiceNumber)}</strong> was due on ${escapeHtml(fmtDate(d.dueDate))} and is now past due. Please remit payment as soon as possible.</p>
    ${detailsBlock(d, company)}
    <p style="font-size:13px;line-height:1.5;color:#737373;margin:16px 0 0;">If payment has already been sent, please disregard this notice.</p>
  `, company)
  const text = `OVERDUE: Invoice ${d.invoiceNumber} for ${fmtMoney(d.total)} was due ${fmtDate(d.dueDate)} and is now past due.`
  return { subject, html, text }
}

export function invoiceEscalatedEmail(d: InvoiceEmailData, company: CompanySettings = defaultCompanySettings) {
  const subject = `FINAL NOTICE: Invoice ${d.invoiceNumber}`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#dc2626;margin:0 0 12px;">Final notice</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">Invoice <strong style="color:#fafafa;">${escapeHtml(d.invoiceNumber)}</strong> has been escalated. Please contact us immediately to resolve this balance.</p>
    ${detailsBlock(d, company)}
  `, company)
  const text = `FINAL NOTICE: Invoice ${d.invoiceNumber} for ${fmtMoney(d.total)} has been escalated.`
  return { subject, html, text }
}

// ---------- Driver welcome ----------

type DriverWelcomeData = {
  name: string
  email: string
  tempPassword: string
  loginUrl: string
}

export function driverWelcomeEmail(d: DriverWelcomeData) {
  const subject = `Welcome to Lv Couriers, ${d.name}`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#fafafa;margin:0 0 12px;">Welcome aboard, ${escapeHtml(d.name)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0 0 16px;">Your driver account is ready. Use the credentials below to sign in and start claiming jobs.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #262626;border-radius:8px;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #262626;">
        <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Email</div>
        <div style="font-size:16px;font-weight:500;color:#fafafa;margin-top:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(d.email)}</div>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Temporary password</div>
        <div style="font-size:16px;font-weight:500;color:#fafafa;margin-top:4px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${escapeHtml(d.tempPassword)}</div>
      </td></tr>
    </table>
    <p style="text-align:center;margin:24px 0;"><a href="${escapeHtml(d.loginUrl)}" style="display:inline-block;padding:12px 24px;background:#ff6b1a;color:#0a0a0a;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Sign in to your dashboard</a></p>
    <p style="font-size:13px;line-height:1.5;color:#737373;margin:16px 0 0;">For your security, please change your password on your first sign-in.</p>
  `)
  const text = `Welcome aboard, ${d.name}.\n\nYour driver account is ready:\nEmail: ${d.email}\nTemporary password: ${d.tempPassword}\n\nSign in: ${d.loginUrl}\n\nPlease change your password on first sign-in.`
  return { subject, html, text }
}

// ---------- Dispute notifications ----------

type DisputeRaisedData = {
  businessName: string
  invoiceNumber: string
  lineItemDescription: string
  claim: string
  adminUrl: string
}

export function disputeRaisedEmail(d: DisputeRaisedData) {
  const subject = `Dispute raised on invoice ${d.invoiceNumber} by ${d.businessName}`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#fafafa;margin:0 0 12px;">New dispute needs review</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">${escapeHtml(d.businessName)} has opened a dispute on invoice <strong style="color:#fafafa;">${escapeHtml(d.invoiceNumber)}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #262626;border-radius:8px;">
      <tr><td style="padding:16px 20px;border-bottom:1px solid #262626;">
        <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Line item</div>
        <div style="font-size:14px;color:#fafafa;margin-top:4px;">${escapeHtml(d.lineItemDescription)}</div>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Business claim</div>
        <div style="font-size:14px;color:#fafafa;margin-top:4px;white-space:pre-wrap;">${escapeHtml(d.claim)}</div>
      </td></tr>
    </table>
    <p style="text-align:center;margin:24px 0;"><a href="${escapeHtml(d.adminUrl)}" style="display:inline-block;padding:12px 24px;background:#ff6b1a;color:#0a0a0a;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Review dispute</a></p>
    <p style="font-size:13px;line-height:1.5;color:#737373;margin:16px 0 0;">Reminders on this invoice are paused until the dispute is resolved.</p>
  `)
  const text = `New dispute: ${d.businessName} disputed "${d.lineItemDescription}" on invoice ${d.invoiceNumber}.\n\nClaim:\n${d.claim}\n\nReview: ${d.adminUrl}`
  return { subject, html, text }
}

type DisputeResolvedData = {
  businessName: string
  invoiceNumber: string
  lineItemDescription: string
  action: 'accept' | 'reject'
  adminResponse: string
  creditAmount: number | null
}

export function disputeResolvedEmail(d: DisputeResolvedData) {
  const accepted = d.action === 'accept'
  const headline = accepted ? 'Credit issued' : 'Dispute declined'
  const subject = accepted
    ? `Credit issued on invoice ${d.invoiceNumber}`
    : `Dispute response for invoice ${d.invoiceNumber}`
  const creditRow = accepted && d.creditAmount != null
    ? `<tr><td style="padding:16px 20px;border-bottom:1px solid #262626;">
        <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Credit amount</div>
        <div style="font-size:24px;font-weight:700;color:#22c55e;margin-top:4px;">${fmtMoney(d.creditAmount)}</div>
      </td></tr>`
    : ''
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:${accepted ? '#22c55e' : '#fafafa'};margin:0 0 12px;">${escapeHtml(headline)}</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">We've finished reviewing your dispute on invoice <strong style="color:#fafafa;">${escapeHtml(d.invoiceNumber)}</strong>.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;border:1px solid #262626;border-radius:8px;">
      ${creditRow}
      <tr><td style="padding:16px 20px;border-bottom:1px solid #262626;">
        <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Line item</div>
        <div style="font-size:14px;color:#fafafa;margin-top:4px;">${escapeHtml(d.lineItemDescription)}</div>
      </td></tr>
      <tr><td style="padding:16px 20px;">
        <div style="font-size:12px;color:#737373;text-transform:uppercase;letter-spacing:0.05em;">Our response</div>
        <div style="font-size:14px;color:#fafafa;margin-top:4px;white-space:pre-wrap;">${escapeHtml(d.adminResponse)}</div>
      </td></tr>
    </table>
  `)
  const text = `${headline}\n\nInvoice ${d.invoiceNumber} — "${d.lineItemDescription}"\n${accepted && d.creditAmount != null ? `Credit: ${fmtMoney(d.creditAmount)}\n` : ''}\nResponse:\n${d.adminResponse}`
  return { subject, html, text }
}

// ---------- Admin review reminder ----------

type ReviewReminderData = {
  draftCount: number
  periodLabel: string
  adminUrl: string
}

export function invoiceReviewReminderEmail(d: ReviewReminderData) {
  const subject = `${d.draftCount} invoice${d.draftCount === 1 ? '' : 's'} awaiting review`
  const html = baseLayout(subject, `
    <h1 style="font-size:22px;font-weight:600;color:#fafafa;margin:0 0 12px;">Drafts ready for review</h1>
    <p style="font-size:15px;line-height:1.6;color:#a3a3a3;margin:0;">${d.draftCount} draft invoice${d.draftCount === 1 ? ' is' : 's are'} ready from the ${escapeHtml(d.periodLabel)} billing period. Review and send before the auto-send date on the 1st.</p>
    <p style="text-align:center;margin:24px 0;"><a href="${escapeHtml(d.adminUrl)}" style="display:inline-block;padding:12px 24px;background:#ff6b1a;color:#0a0a0a;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Open invoice review</a></p>
  `)
  const text = `${d.draftCount} draft invoice${d.draftCount === 1 ? '' : 's'} from ${d.periodLabel} are awaiting review.\n\n${d.adminUrl}`
  return { subject, html, text }
}
