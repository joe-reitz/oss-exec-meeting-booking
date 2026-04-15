/**
 * Generates the booking confirmation email HTML using the official
 * Vercel email template (with dark mode, Outlook compat, branding).
 */

interface BookingConfirmationParams {
  vercelAttendeeNames: string[]; // e.g. ["Guillermo Rauch", "Nick Bogaty"]
  dateTime: string; // pre-formatted, e.g. "Tuesday, June 30 at 2:00 PM (Los Angeles)"
  location?: string;
  attendeeLines?: string; // pre-formatted HTML lines for attendees
  googleCalendarUrl?: string; // opens Google Calendar to add the event
  icsDownloadUrl?: string; // link to download the .ics file
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderBookingConfirmationHtml(
  params: BookingConfirmationParams
): string {
  const { vercelAttendeeNames, dateTime, location, attendeeLines, googleCalendarUrl, icsDownloadUrl } = params;

  // Build the opening line: "Your meeting with X and Y is confirmed."
  const nameList = vercelAttendeeNames.map(escapeHtml);
  let withClause: string;
  if (nameList.length === 0) {
    withClause = "Your meeting";
  } else if (nameList.length === 1) {
    withClause = `Your meeting with <strong>${nameList[0]}</strong>`;
  } else if (nameList.length === 2) {
    withClause = `Your meeting with <strong>${nameList[0]}</strong> and <strong>${nameList[1]}</strong>`;
  } else {
    const last = nameList.pop()!;
    withClause = `Your meeting with <strong>${nameList.join("</strong>, <strong>")}</strong>, and <strong>${last}</strong>`;
  }

  // Build the body content
  const bodyParts: string[] = [
    `${withClause} is confirmed. We look forward to seeing you.&nbsp;`,
    `&nbsp;`,
    `<strong>When:</strong> ${escapeHtml(dateTime)}`,
  ];

  if (location) {
    bodyParts.push(`<strong>Where:</strong> ${escapeHtml(location)}`);
  }

  if (attendeeLines) {
    bodyParts.push(`&nbsp;`);
    bodyParts.push(`<strong>Attendees:</strong>`);
    bodyParts.push(attendeeLines);
  }

  // Calendar links — Google opens directly, Apple/Outlook download .ics
  const linkStyle = `color: #0070F3; text-decoration: none;`;
  let calendarText: string;
  if (googleCalendarUrl && icsDownloadUrl) {
    calendarText = `<br>Add to your <a href="${escapeHtml(googleCalendarUrl)}" target="_blank" style="${linkStyle}">Google</a>, <a href="${escapeHtml(icsDownloadUrl)}" style="${linkStyle}">Apple</a>, or <a href="${escapeHtml(icsDownloadUrl)}" style="${linkStyle}">Outlook</a> calendar.`;
  } else if (icsDownloadUrl) {
    calendarText = `<br><a href="${escapeHtml(icsDownloadUrl)}" style="${linkStyle}">Add to your Apple or Outlook calendar</a>.`;
  } else {
    calendarText = `<br>A calendar invite is attached — add it to your Google, Apple, or Outlook calendar.`;
  }

  bodyParts.push(
    calendarText,
    `&nbsp;`,
    `&nbsp;`,
    `Thank you,`,
    `&nbsp;`,
    `▲ The Vercel Team`,
  );

  const bodyHtml = bodyParts
    .map((line) => `<p style="margin: 0 0 0px 0;">${line}</p>`)
    .join("");

  const previewText = vercelAttendeeNames.length > 0
    ? `Meeting confirmed with ${vercelAttendeeNames.join(", ")} — ${escapeHtml(dateTime)}`
    : `Meeting confirmed — ${escapeHtml(dateTime)}`;

  // The full template adapted from the official Vercel event email
  return `<!doctype html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><title></title><!--[if !mso]><!-- --><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]--><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style type="text/css">#outlook a { padding:0; }
          table { border-spacing:0;}
          img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
          p { display:block; }
          :root { color-scheme: light dark; }</style><!--[if mso]>
          <xml>
            <o:OfficeDocumentSettings xmlns:o="urn:schemas-microsoft-com:office:office">
              <o:AllowPNG/>
              <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
            <w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
              <w:DontUseAdvancedTypographyReadingMail/>
            </w:WordDocument>
          </xml>
          <style type="text/css">
            table { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
            .mj-outlook-group-fix { width:100% !important; }
          </style>
        <![endif]--><!--[if !mso]><!--><link href="https://client-data.knak.io/production/company_data/672a519344809/custom-fonts/672b8bb24c152/fonts.css" rel="stylesheet" type="text/css"><style type="text/css">@import url(https://client-data.knak.io/production/company_data/672a519344809/custom-fonts/672b8bb24c152/fonts.css);</style><!--<![endif]--><style type="text/css">@media only screen and (min-width:480px) {
        .mj-column-per-100 { width:100% !important; max-width: 100%; }
      }</style><style type="text/css">body, .body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
[data-ogsc] .img-container img:hover, [data-ogsb] .img-container img:hover { background-color: transparent !important }
.links-0070F3 a { color: #0070F3; text-decoration: none; }
#body #main [x-apple-data-detectors-type] {
          color: inherit !important;
          -webkit-text-decoration-color: inherit !important;
          text-decoration: inherit !important;
          font-weight: inherit !important;
         }
[data-ogsc] .social-container img:hover, [data-ogsb] .social-container img:hover { background-color: transparent !important }
.links-454545 a { color: #454545; text-decoration: none; }
            @media screen and (prefers-color-scheme: dark) {
                .dark-mode-background-color-000000:not([class^="x_"]) { background-color: #000000 !important}
.light-mode-image:not([class^="x_"]) { display: none !important } .dark-mode-image:not([class^="x_"]) { display: block !important }
.dark-mode-color-A0A0A0:not([class^="x_"]) { color: #A0A0A0 !important}
.dark-mode-color-8C8C8C:not([class^="x_"]) { color: #8C8C8C !important}
.dark-mode-link-color-8C8C8C:not([class^="x_"]) a { color: #8C8C8C !important}
            }</style><style type="text/css">ul{display: block;}sup, sub{line-height:0;}body a{text-decoration: none; color: #0070F3;}.image-highlight{transition: 0.3s;}.image-highlight:hover{filter: brightness(1.2);}@media only screen and (min-width: 480px) { .hide-on-mobile{display:block !important;}.hide-on-desktop{display:none !important;} }.hide-on-desktop{display:block;}.hide-on-mobile{display:none;}</style><!--[if mso]>
            <style>
                .hide-on-mobile {display:block !important}
            </style>
        <![endif]--><style>[class~="x_body"] { width: 99.9% }</style>
</head>
<body style="word-spacing:normal;background-color:#FFFFFF;" class="body dark-mode-background-color-000000" id="body"><!--[if !mso 9]><!--><div id="emailPreHeader" style="display: none;">${previewText}</div><!--<![endif]--><div class="dark-mode-background-color-000000" style="background-color:#FFFFFF;background-position:center center;background-size:auto;background-repeat:repeat;" id="main">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#FFFFFF;width:100%;" class="section dark-mode-background-color-000000">
<tr>
<td align="center"><div role="none"><!--[if mso | IE]>
<table align="center" border="0" cellpadding="0" cellspacing="0" class="block-grid-outlook" style="width:600px;" width="600" >
<tr>
<td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;"><![endif]--><div style="background:transparent;background-color:transparent;margin:0 auto;max-width:600px;">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="background-color:transparent;width:100%;">
<tr>
<td style="font-size:0px;padding:0;text-align:center;vertical-align:top;" class="block-grid"><!--[if mso | IE]>
<table role="presentation" border="0" cellpadding="0" cellspacing="0">
<tr>
<td style="vertical-align:top;width:600px;" ><![endif]--><div class="mj-column-per-100 mj-outlook-group-fix" style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:0px;vertical-align:top;" width="100%">
<tr>
<td class="img-container" style="font-size:0px;padding:48px 24px 8px 24px;word-break:break-word;text-align:center;"><div style="margin:0 auto;max-width:96px;"><a href="https://vercel.com" target="_blank" style="text-decoration: none; color: #0070F3;"><img alt height="auto" width="96" src="https://res.cloudinary.com/zeit-inc/image/upload/f_auto,q_auto/v1/email/vercel-circle" style="border:none;border-radius:0px;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;display:block;" class="light-mode-image"> <!--[if !mso]><!--><img alt height="auto" width="96" src="https://res.cloudinary.com/zeit-inc/image/upload/f_auto,q_auto/v1/email/vercel-circle-dark" style="border:none;border-radius:0px;outline:none;text-decoration:none;height:auto;width:100%;font-size:13px;display:none;" class="dark-mode-image"><!--<![endif]--></a></div>
</td>
</tr>
<tr>
<td class="text-container" style="font-size:0px;padding:8px 24px 8px 24px;word-break:break-word;text-align:left;"><div class="links-0070F3"><div style="font-family:'Geist', Arial, sans-serif;font-size:16px;font-weight:normal;letter-spacing:none;line-height:1.50;text-align:left;mso-line-height-alt:1.5em;color:#666666;" class="dark-mode-color-A0A0A0">${bodyHtml}</div></div>
</td>
</tr>
<tr>
<td style="font-size:0px;padding:16px 24px 16px 24px;word-break:break-word;text-align:center;">
<table width="100%" role="none" border="0" cellpadding="0" cellspacing="0" style="border-top:solid 1px #80808033;font-size:0;display:inline-block;line-height:0;">
<tr>
<td height="0" style="height:0;line-height:0;">&nbsp;</td>
</tr>
</table>
</td>
</tr>
<tr>
<td class="social-container" style="font-size:0px;padding:4px 24px 4px 24px;word-break:break-word;text-align:center;"><!--[if mso | IE]>
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" >
<tr>
<td><![endif]--><div style="display:inline-block;">
<table align="center" border="0" cellpadding="0" cellspacing="0" role="presentation" style="float:none;display:inline-table;">
<tr>
<td style="padding:8px;">
<table border="0" cellpadding="0" cellspacing="0" role="presentation" style="border-radius:0px;width:24px;">
<tr>
<td style="padding:0px;font-size:0;height:24px;vertical-align:middle;width:24px;"><a href="https://x.com/vercel" target="_blank" style="text-decoration: none; color: #0070F3;"><img alt="X" height="24" src="https://assets.vercel.com/image/upload/v1732879213/email/logo-x.png" style="border-radius:0px;display:block;" width="24"></a>
</td>
</tr>
</table>
</td>
</tr>
</table></div><!--[if mso | IE]>
</td>
</tr>
</table><![endif]-->
</td>
</tr>
<tr>
<td class="text-container" style="font-size:0px;padding:10px 10px 15px 10px;word-break:break-word;text-align:center;"><div class="links-454545"><div style="font-family:'Geist', Arial, sans-serif;font-size:12px;font-weight:400;letter-spacing:0.1px;line-height:1.4;text-align:center;mso-line-height-alt:1.063em;color:#454545;" class="dark-mode-color-8C8C8C dark-mode-link-color-8C8C8C"><p style="margin: 0 0 0px 0;"><span style="font-family: Geist, Arial, sans-serif;"><a href="https://vercel.com/contact" target="_blank" rel="noopener" style="color: rgb(69, 69, 69); text-decoration: none;">Talk to a Vercel expert</a> &#8594;</span><br><span style="font-family: Geist, Arial, sans-serif;"><a href="https://vercel.com/docs" target="_blank" rel="noopener" style="color: rgb(69, 69, 69); text-decoration: none;">Docs</a> | <a href="https://vercel.com/blog" target="_blank" rel="noopener" style="color: rgb(69, 69, 69); text-decoration: none;">Blog</a> | <a href="https://vercel.com/contact" target="_blank" rel="noopener" style="color: rgb(69, 69, 69); text-decoration: none;">Contact</a> | <a href="https://community.vercel.com" target="_blank" rel="noopener" style="color: rgb(69, 69, 69); text-decoration: none;">Community</a> | <a href="https://vercel.com/careers" target="_blank" rel="noopener" style="color: rgb(69, 69, 69); text-decoration: none;">Careers</a></span><br><span style="font-family: Geist, Arial, sans-serif;">440 N Barranca Ave #4133 Covina, CA 91723</span><br><span style="font-family: Geist, Arial, sans-serif;">Copyright &copy; 2026 Vercel Inc. All rights reserved.</span><br><span style="font-family: Geist, Arial, sans-serif;">View our <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener" style="color: rgb(69, 69, 69); text-decoration: none;">Privacy Policy</a>.</span></p></div></div>
</td>
</tr>
</table></div><!--[if mso | IE]>
</td>
</tr>
</table><![endif]-->
</td>
</tr>
</table></div><!--[if mso | IE]>
</td>
</tr>
</table><![endif]--></div>
</td>
</tr>
</table></div>
</body></html>`;
}
