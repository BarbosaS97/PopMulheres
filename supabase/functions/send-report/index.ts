import { PDFDocument, PDFPage, rgb } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";
import nodemailer from "npm:nodemailer@6.9.13";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemberProfile {
  escolaridade: string;
  raca_etnia: string;
  genero: string;
  idade: number;
  obs?: string;
}

interface ServiceItem {
  organ_name: string;
  service_name: string;
}

interface Child {
  id: number;
  name: string;
  age?: number;
  profile?: MemberProfile;
  services: ServiceItem[];
}

interface Questionnaire {
  homeless: boolean;
  domestic_violence: boolean;
  protective_measure: boolean;
  children_school: boolean;
  serious_illness: boolean;
  obs?: string;
}

interface ReportPayload {
  mother: {
    id: number;
    name: string;
    birth_date?: string;
    cpf?: string;
    observation?: string;
    profile?: MemberProfile;
    services: ServiceItem[];
  };
  questionnaire: Questionnaire;
  children: Child[];
  attendanceDate: string;
}

// ─── PDF ──────────────────────────────────────────────────────────────────────

async function generatePDF(data: ReportPayload): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const [regularBytes, boldBytes] = await Promise.all([
    fetch("https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Regular.ttf")
      .then((r) => r.arrayBuffer())
      .then((b) => new Uint8Array(b)),
    fetch("https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Bold.ttf")
      .then((r) => r.arrayBuffer())
      .then((b) => new Uint8Array(b)),
  ]);

  const regular = await doc.embedFont(regularBytes, { subset: true });
  const bold = await doc.embedFont(boldBytes, { subset: true });

  const colorPurple = rgb(0.48, 0.29, 0.58);
  const colorDark = rgb(0.17, 0.1, 0.3);
  const colorGray = rgb(0.45, 0.45, 0.45);
  const colorLight = rgb(0.95, 0.94, 0.99);
  const colorWhite = rgb(1, 1, 1);
  const colorSubtitle = rgb(0.9, 0.85, 1);

  const PAGE_W = 595;
  const PAGE_H = 842;
  const MARGIN_LEFT = 40;
  const CONTENT_WIDTH = PAGE_W - 80;

  function newPage(): { page: PDFPage; cursor: number } {
    const p = doc.addPage([PAGE_W, PAGE_H]);
    p.drawRectangle({
      x: 0,
      y: PAGE_H - 52,
      width: PAGE_W,
      height: 52,
      color: colorPurple,
    });
    p.drawText("PopRuaJud - Mulheres Guerreiras", {
      x: MARGIN_LEFT,
      y: PAGE_H - 34,
      font: bold,
      size: 14,
      color: colorWhite,
    });
    p.drawText("Relatorio de Atendimento", {
      x: MARGIN_LEFT,
      y: PAGE_H - 48,
      font: regular,
      size: 8,
      color: colorSubtitle,
    });
    return { page: p, cursor: PAGE_H - 72 };
  }

  function drawSectionTitle(page: PDFPage, cursor: number, title: string): number {
    page.drawRectangle({
      x: MARGIN_LEFT,
      y: cursor - 18,
      width: CONTENT_WIDTH,
      height: 22,
      color: colorLight,
    });
    page.drawText(title, {
      x: MARGIN_LEFT + 8,
      y: cursor - 12,
      font: bold,
      size: 10,
      color: colorPurple,
    });
    return cursor - 30;
  }

  function drawField(
    page: PDFPage,
    cursor: number,
    label: string,
    value: string,
    indent: number
  ): number {
    page.drawText(label + ":", {
      x: MARGIN_LEFT + indent,
      y: cursor,
      font: bold,
      size: 9,
      color: colorGray,
    });
    page.drawText(value !== "" ? value : "-", {
      x: MARGIN_LEFT + indent + 110,
      y: cursor,
      font: regular,
      size: 9,
      color: colorDark,
    });
    return cursor - 14;
  }

  function drawCheckItem(
    page: PDFPage,
    cursor: number,
    label: string,
    checked: boolean
  ): number {
    page.drawText(checked ? "[X]" : "[ ]", {
      x: MARGIN_LEFT + 8,
      y: cursor,
      font: bold,
      size: 9,
      color: checked ? colorPurple : colorGray,
    });
    page.drawText(label, {
      x: MARGIN_LEFT + 32,
      y: cursor,
      font: regular,
      size: 9,
      color: colorDark,
    });
    return cursor - 14;
  }

  function wrapText(text: string, maxChars: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      if ((current + word).length > maxChars) {
        if (current.length > 0) {
          lines.push(current.trimEnd());
        }
        current = word + " ";
      } else {
        current = current + word + " ";
      }
    }
    if (current.trim().length > 0) {
      lines.push(current.trimEnd());
    }
    return lines;
  }

  // ── Pagina 1 ────────────────────────────────────────────────────────────────

  let state = newPage();
  let page = state.page;
  let cursor = state.cursor;

  // Titulo do relatorio
  cursor = cursor - 8;
  page.drawText("Atendimento: " + data.mother.name, {
    x: MARGIN_LEFT,
    y: cursor,
    font: bold,
    size: 13,
    color: colorPurple,
  });
  cursor = cursor - 16;
  page.drawText("Data: " + data.attendanceDate, {
    x: MARGIN_LEFT,
    y: cursor,
    font: regular,
    size: 9,
    color: colorGray,
  });
  cursor = cursor - 20;

  // ── Dados da mae ────────────────────────────────────────────────────────────

  cursor = drawSectionTitle(page, cursor, "DADOS DA MAE");
  cursor = drawField(page, cursor, "Nome", data.mother.name, 0);

  if (data.mother.birth_date !== undefined && data.mother.birth_date !== null && data.mother.birth_date !== "") {
    const birthDate = new Date(data.mother.birth_date + "T12:00:00");
    const day = String(birthDate.getDate()).padStart(2, "0");
    const month = String(birthDate.getMonth() + 1).padStart(2, "0");
    const year = birthDate.getFullYear();
    cursor = drawField(page, cursor, "Nascimento", day + "/" + month + "/" + year, 0);
  }

  if (data.mother.cpf !== undefined && data.mother.cpf !== null && data.mother.cpf !== "") {
    cursor = drawField(page, cursor, "CPF", data.mother.cpf, 0);
  }

  if (data.mother.observation !== undefined && data.mother.observation !== null && data.mother.observation !== "") {
    cursor = drawField(page, cursor, "Observacao", data.mother.observation, 0);
  }

  if (data.mother.profile !== undefined && data.mother.profile !== null) {
    const mp = data.mother.profile;
    cursor = drawField(page, cursor, "Escolaridade", mp.escolaridade, 0);
    cursor = drawField(page, cursor, "Raca/Etnia", mp.raca_etnia, 0);
    cursor = drawField(page, cursor, "Genero", mp.genero, 0);
    cursor = drawField(page, cursor, "Idade", mp.idade + " anos", 0);
  }

  cursor = cursor - 8;

  // ── Questionario ────────────────────────────────────────────────────────────

  if (cursor < 140) {
    state = newPage();
    page = state.page;
    cursor = state.cursor;
  }

  cursor = drawSectionTitle(page, cursor, "QUESTIONARIO DE ACOLHIMENTO");
  cursor = drawCheckItem(page, cursor, "Mulher em situacao de rua", data.questionnaire.homeless);
  cursor = drawCheckItem(page, cursor, "Sofre violencia domestica", data.questionnaire.domestic_violence);
  cursor = drawCheckItem(page, cursor, "Tem medida protetiva", data.questionnaire.protective_measure);
  cursor = drawCheckItem(page, cursor, "Filhos frequentam ambiente escolar", data.questionnaire.children_school);
  cursor = drawCheckItem(page, cursor, "Diagnostico de doenca grave", data.questionnaire.serious_illness);

  if (data.questionnaire.obs !== undefined && data.questionnaire.obs !== null && data.questionnaire.obs !== "") {
    cursor = cursor - 4;
    page.drawText("Obs:", {
      x: MARGIN_LEFT + 8,
      y: cursor,
      font: bold,
      size: 9,
      color: colorGray,
    });
    cursor = cursor - 13;
    const obsLines = wrapText(data.questionnaire.obs, 80);
    for (let i = 0; i < obsLines.length; i++) {
      if (cursor < 60) {
        state = newPage();
        page = state.page;
        cursor = state.cursor;
      }
      page.drawText(obsLines[i], {
        x: MARGIN_LEFT + 16,
        y: cursor,
        font: regular,
        size: 9,
        color: colorDark,
      });
      cursor = cursor - 13;
    }
  }

  cursor = cursor - 8;

  // ── Servicos da mae ─────────────────────────────────────────────────────────

  if (data.mother.services.length > 0) {
    if (cursor < 80) {
      state = newPage();
      page = state.page;
      cursor = state.cursor;
    }
    cursor = drawSectionTitle(page, cursor, "SERVICOS SOLICITADOS - MAE");
    for (let i = 0; i < data.mother.services.length; i++) {
      if (cursor < 60) {
        state = newPage();
        page = state.page;
        cursor = state.cursor;
      }
      const s = data.mother.services[i];
      page.drawText("* " + s.organ_name + " / " + s.service_name, {
        x: MARGIN_LEFT + 8,
        y: cursor,
        font: regular,
        size: 9,
        color: colorDark,
      });
      cursor = cursor - 14;
    }
    cursor = cursor - 4;
  }

  // ── Filhos ──────────────────────────────────────────────────────────────────

  for (let ci = 0; ci < data.children.length; ci++) {
    const child = data.children[ci];

    if (cursor < 120) {
      state = newPage();
      page = state.page;
      cursor = state.cursor;
    }

    const childTitle = "FILHO(A): " + child.name.toUpperCase();
    cursor = drawSectionTitle(page, cursor, childTitle);

    if (child.age !== undefined && child.age !== null) {
      cursor = drawField(page, cursor, "Idade", child.age + " anos", 0);
    }

    if (child.profile !== undefined && child.profile !== null) {
      const cp = child.profile;
      cursor = drawField(page, cursor, "Escolaridade", cp.escolaridade, 0);
      cursor = drawField(page, cursor, "Raca/Etnia", cp.raca_etnia, 0);
      cursor = drawField(page, cursor, "Genero", cp.genero, 0);

      if (cp.obs !== undefined && cp.obs !== null && cp.obs !== "") {
        cursor = cursor - 2;
        const obsLines = wrapText("Obs: " + cp.obs, 80);
        for (let li = 0; li < obsLines.length; li++) {
          if (cursor < 60) {
            state = newPage();
            page = state.page;
            cursor = state.cursor;
          }
          page.drawText(obsLines[li], {
            x: MARGIN_LEFT + 8,
            y: cursor,
            font: regular,
            size: 9,
            color: colorGray,
          });
          cursor = cursor - 13;
        }
      }
    }

    if (child.services.length > 0) {
      cursor = cursor - 4;
      page.drawText("Servicos:", {
        x: MARGIN_LEFT + 8,
        y: cursor,
        font: bold,
        size: 9,
        color: colorGray,
      });
      cursor = cursor - 13;
      for (let si = 0; si < child.services.length; si++) {
        if (cursor < 60) {
          state = newPage();
          page = state.page;
          cursor = state.cursor;
        }
        const s = child.services[si];
        page.drawText("* " + s.organ_name + " / " + s.service_name, {
          x: MARGIN_LEFT + 16,
          y: cursor,
          font: regular,
          size: 9,
          color: colorDark,
        });
        cursor = cursor - 13;
      }
    }

    cursor = cursor - 8;
  }

  // ── Rodape em todas as paginas ───────────────────────────────────────────────

  const allPages = doc.getPages();
  const totalPages = allPages.length;
  const now = new Date();
  const nowDay = String(now.getDate()).padStart(2, "0");
  const nowMonth = String(now.getMonth() + 1).padStart(2, "0");
  const nowYear = now.getFullYear();
  const nowHour = String(now.getHours()).padStart(2, "0");
  const nowMin = String(now.getMinutes()).padStart(2, "0");
  const nowStr = nowDay + "/" + nowMonth + "/" + nowYear + " " + nowHour + ":" + nowMin;

  for (let pi = 0; pi < allPages.length; pi++) {
    allPages[pi].drawText(
      "Pagina " + (pi + 1) + " de " + totalPages + "  |  Gerado em " + nowStr,
      {
        x: MARGIN_LEFT,
        y: 18,
        font: regular,
        size: 7,
        color: colorGray,
      }
    );
  }

  return doc.save();
}

// ─── Email ────────────────────────────────────────────────────────────────────

async function sendEmail(
  pdfBytes: Uint8Array,
  motherName: string,
  dateStr: string
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: "cibercastof@gmail.com",
      pass: "rmmp hqxl fqgx muyp",
    },
  });

  const safeName = motherName.replace(/\s+/g, "_");
  const safeDate = dateStr.replace(/\//g, "-");
  const filename = "Relatorio_" + safeName + "_" + safeDate + ".pdf";

  const htmlBody =
    '<div style="font-family:Arial,sans-serif;color:#2d1b4e;max-width:600px;">' +
    '<div style="background:#7A4895;padding:20px;border-radius:12px 12px 0 0;">' +
    '<h2 style="color:#fff;margin:0;">PopRuaJud - Mulheres Guerreiras</h2>' +
    '<p style="color:#e9d5ff;margin:4px 0 0;">Sistema de Triagem</p>' +
    "</div>" +
    '<div style="background:#faf5ff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e9d5ff;">' +
    "<p>Ola,</p>" +
    "<p>Segue em anexo o relatorio de atendimento de <strong>" +
    motherName +
    "</strong>, registrado em <strong>" +
    dateStr +
    "</strong>.</p>" +
    '<p style="color:#7A4895;font-size:0.85rem;margin-top:24px;">' +
    "Este e-mail foi gerado automaticamente pelo sistema PopRuaJud." +
    "</p>" +
    "</div>" +
    "</div>";

  await transporter.sendMail({
    from: '"PopRuaJud - Mulheres Guerreiras" <cibercastof@gmail.com>',
    to: "contatktk387@gmail.com",
    subject: "Relatorio de Atendimento - " + motherName + " - " + dateStr,
    html: htmlBody,
    attachments: [
      {
        filename: filename,
        content: pdfBytes,
        contentType: "application/pdf",
      },
    ],
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const corsOrigin = "Access-Control-Allow-Origin";
  const corsHeaders = "Access-Control-Allow-Headers";
  const corsHeadersValue = "authorization, x-client-info, apikey, content-type";
  const corsAllOrigin = "*";

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: new Headers([
        [corsOrigin, corsAllOrigin],
        [corsHeaders, corsHeadersValue],
      ]),
    });
  }

  try {
    const data: ReportPayload = await req.json();
    const pdfBytes = await generatePDF(data);
    await sendEmail(pdfBytes, data.mother.name, data.attendanceDate);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: new Headers([
        ["Content-Type", "application/json"],
        [corsOrigin, corsAllOrigin],
        [corsHeaders, corsHeadersValue],
      ]),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("send-report error:", message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: new Headers([
        ["Content-Type", "application/json"],
        [corsOrigin, corsAllOrigin],
        [corsHeaders, corsHeadersValue],
      ]),
    });
  }
});
