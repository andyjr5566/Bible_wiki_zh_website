/**
 * 搜尋結果的一行摘要。
 * 先在全文找到搜尋詞實際出現的位置（中文沒有空白，命中多半在詞的中間，不能用「以搜尋詞開頭的詞」判斷），
 * 取前後的字，從句子開頭開始；流程圖原始碼與網址開頭的行不當內文，除非搜尋詞只出現在那裡。
 */

const BEFORE_CHARS = 30;
const AFTER_CHARS = 100;
/** 命中前最多往回找 30 字的句子開頭；找不到就直接從命中前 30 字切開（加「...」）。 */
const SENTENCE_LOOKBACK = BEFORE_CHARS;
const LEAD_MIN_LINE_LENGTH = 12;
const SENTENCE_END = /[。！？；]/;
const ALNUM = /[A-Za-z0-9]/;
const DIAGRAM_LINE =
  /-->|==>|^\s*(?:flowchart|graph\s+(?:TD|TB|BT|LR|RL)|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|mindmap|subgraph|classDef|linkStyle)\b/i;
/** 來源說明行：網址（常放在括號裡）或「來源依據」開頭，不是讀者要看的內文。 */
const URL_LINE = /(?:https?:\/\/|www\.)\S+|^\s*來源依據/i;
const LABEL_ONLY_LINE = /^\s*[A-Za-z]{1,6}\s*[:：]\s*$/;

export interface SnippetOptions {
  /** 條目標題；內文第一行就是標題時略過。 */
  title?: string;
}

interface TextLine {
  text: string;
  noise: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** 索引裡的內文有些已經轉義過（&lt;br/&gt;、--&gt;），先還原，顯示時才不會看到符號本身。 */
function decodeBasicEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, "&");
}

/** 轉成小寫但長度不變，命中的位置才能對回原文。 */
function foldCase(value: string): string {
  let folded = "";
  for (const char of value) {
    const lower = char.toLowerCase();
    folded += lower.length === char.length ? lower : char;
  }
  return folded;
}

function splitLines(text: string, title: string | undefined): TextLine[] {
  const cleaned = decodeBasicEntities(text.normalize("NFC"))
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/?[A-Za-z][^<>]*>/g, "");
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
  const normalizedTitle = title?.normalize("NFC").trim();
  if (normalizedTitle && lines[0] === normalizedTitle) lines.shift();

  return lines.map((line) => ({
    text: line,
    noise: DIAGRAM_LINE.test(line) || URL_LINE.test(line) || LABEL_ONLY_LINE.test(line),
  }));
}

function getCandidates(query: string): string[] {
  const whole = query.normalize("NFC").trim();
  if (whole === "") return [];
  const tokens = whole.split(/\s+/).filter((token) => token.length >= 2);
  const unique = Array.from(new Set([whole, ...tokens]));
  return unique.sort((a, b) => b.length - a.length);
}

function findFirstHit(
  source: string,
  candidates: readonly string[],
): { index: number; length: number } | null {
  const folded = foldCase(source);
  for (const candidate of candidates) {
    const index = folded.indexOf(foldCase(candidate));
    if (index !== -1) return { index, length: candidate.length };
  }
  return null;
}

function highlightText(window: string, candidates: readonly string[]): string {
  if (candidates.length === 0) return escapeHtml(window);
  const pattern = candidates.map((candidate) => candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const parts = window.split(new RegExp(`(${pattern.join("|")})`, "gi"));
  return parts
    .map((part, index) =>
      index % 2 === 1 ? `<span class="highlight">${escapeHtml(part)}</span>` : escapeHtml(part),
    )
    .join("");
}

/** 回傳可以放進 innerHTML 的摘要（只有 <span class="highlight">）；沒有內文時回傳空字串。 */
export function buildSnippetHtml(
  text: string,
  query: string,
  options: SnippetOptions = {},
): string {
  const lines = splitLines(text, options.title);
  if (lines.length === 0) return "";

  const candidates = getCandidates(query);
  const prose = lines
    .filter((line) => !line.noise)
    .map((line) => line.text)
    .join("\n");
  const everything = lines.map((line) => line.text).join("\n");

  let source = prose;
  let hit = candidates.length > 0 ? findFirstHit(prose, candidates) : null;
  if (!hit && candidates.length > 0) {
    source = everything;
    hit = findFirstHit(everything, candidates);
  }

  let start: number;
  let end: number;
  let cleanStart: boolean;

  if (hit) {
    start = Math.max(0, hit.index - BEFORE_CHARS);
    cleanStart = start === 0;
    const lookbackLimit = Math.max(0, hit.index - SENTENCE_LOOKBACK);
    for (let i = hit.index - 1; i >= lookbackLimit; i--) {
      if (source[i] === "\n" || SENTENCE_END.test(source[i] ?? "")) {
        start = i + 1;
        cleanStart = true;
        break;
      }
    }
    // 不要從英文單字或數字中間切開
    if (!cleanStart) {
      while (
        start < hit.index &&
        ALNUM.test(source[start - 1] ?? "") &&
        ALNUM.test(source[start] ?? "")
      ) {
        start++;
      }
    }
    end = Math.min(source.length, hit.index + hit.length + AFTER_CHARS);
  } else {
    // 沒有找到搜尋詞（語意相關的結果）：從內文開頭的第一個完整段落開始
    source = prose !== "" ? prose : everything;
    const leadLine = (prose !== "" ? lines.filter((line) => !line.noise) : lines).find(
      (line) => line.text.length >= LEAD_MIN_LINE_LENGTH,
    );
    start = leadLine ? source.indexOf(leadLine.text) : 0;
    if (start < 0) start = 0;
    cleanStart = true;
    end = Math.min(source.length, start + BEFORE_CHARS + AFTER_CHARS);
  }

  const windowText = source
    .slice(start, end)
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (windowText === "") return "";

  const prefix = cleanStart ? "" : "...";
  const suffix = end < source.length ? "..." : "";
  return prefix + highlightText(windowText, candidates) + suffix;
}
