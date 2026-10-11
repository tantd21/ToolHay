const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const GEMINI_TEXT_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_FALLBACK_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

const IMAGEN_URL = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`;

const STYLE_PROMPT_PREFIX = `2D digital illustration, MS Paint style, simple educational webcomic doodle, bold thick black outlines, flat color, minimalist background, funny meme aesthetic, simplified blob character, exaggerated derpy facial expression, historical educational comic vibe`;

async function parseScriptToScenes(scriptText) {
  console.log("[Gemini] Đang phân tích kịch bản DÀI (5-10 phút)...");

  const systemPrompt = `Bạn là một biên tập viên hoạt hình 2D chuyên nghiệp tạo các video DÀI từ 5 đến 10 PHÚT dạy kiến thức LỊCH SỬ, KHOA HỌC & ĐỜI SỐNG theo phong cách dí dỏm, bựa, dễ hiểu (Edu-Meme Animation).

Nhiệm vụ của bạn:
Phân chia kịch bản hoặc chủ đề kiến thức tiếng Việt thành danh sách các cảnh (Scenes) chi tiết (từ 15 đến 45 cảnh).

Mỗi cảnh cần có:
1. "sceneId": Số thứ tự cảnh (1, 2, 3...)
2. "dialogue": Lời thuyết minh/câu thoại tiếng Việt ngắn gọn, dí dỏm.
3. "characterExpression": Biểu cảm hoặc vai nhân vật (Ví dụ: "Tướng quân hô hào bựa", "Nhà khoa học ngơ ngác", "Vua phán hoảng hốt", "Blob tò mò"...).
4. "imagePrompt": Mô tả hình ảnh minh họa cảnh TIẾNG ANH cho AI Image Generator theo phong cách:
   "${STYLE_PROMPT_PREFIX}"

Trả về ĐÚNG MỘT MẢNG JSON theo cấu trúc:
[
  {
    "sceneId": 1,
    "dialogue": "Lời giải thích kiến thức lịch sử/khoa học tiếng Việt",
    "characterExpression": "Tên vai/cảm xúc nhân vật",
    "imagePrompt": "Detailed English prompt describing the historical/educational 2D MS Paint doodle scene"
  }
]
Chú ý: Chỉ trả về chuỗi JSON hợp lệ, KHÔNG bọc trong mã Markdown hay bất kỳ ký tự nào khác.`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: systemPrompt },
          { text: `Đầu vào kịch bản/chủ đề kiến thức:\n${scriptText}` },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.7,
    },
  };

  try {
    let response = await fetch(GEMINI_TEXT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.warn("[Gemini] Model 2.5 flash gặp sự cố, thử fallback model...");
      response = await fetch(GEMINI_FALLBACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
    }

    if (response.ok) {
      const data = await response.json();
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const rawText = data.candidates[0].content.parts[0].text;
        const cleanText = rawText
          .trim()
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/\s*```$/i, "");

        const scenes = JSON.parse(cleanText);
        if (Array.isArray(scenes) && scenes.length > 0) {
          return scenes;
        }
      }
    }
  } catch (err) {
    console.warn(
      `[Gemini API Warning] ${err.message}. Đang kích hoạt bộ tách phân cảnh thông minh...`,
    );
  }

  return generateSmartLocalScenes(scriptText);
}

function generateSmartLocalScenes(scriptText) {
  console.log(
    "[Local Splitter] Đang tự động tách kịch bản thành các phân cảnh...",
  );
  const sentences = scriptText
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  if (sentences.length === 0) {
    sentences.push(scriptText);
  }

  return sentences.map((sentence, index) => ({
    sceneId: index + 1,
    dialogue: sentence,
    characterExpression:
      index === 0 ? "Giới thiệu tò mò" : "Giải thích bựa derpy",
    imagePrompt: `${STYLE_PROMPT_PREFIX}, illustration for: ${sentence}`,
  }));
}

async function generate2DImage(promptText, outputPath) {
  console.log(`[Gemini Image] Tạo ảnh 2D: "${promptText.substring(0, 50)}..."`);

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const fullPrompt = `${STYLE_PROMPT_PREFIX}, ${promptText}`;

  try {
    const response = await fetch(IMAGEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: fullPrompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "16:9",
          outputOptions: { mimeType: "image/png" },
        },
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (
        data.predictions &&
        data.predictions[0] &&
        data.predictions[0].bytesBase64Encoded
      ) {
        const base64Data = data.predictions[0].bytesBase64Encoded;
        const pngPath = outputPath.endsWith(".png")
          ? outputPath
          : outputPath.replace(/\.[^.]+$/, ".png");
        await fs.promises.writeFile(pngPath, Buffer.from(base64Data, "base64"));
        return pngPath;
      }
    }
  } catch (err) {
    console.warn(`[Gemini Image Notice] ${err.message}`);
  }

  return generateFallback2DEduSketch(promptText, outputPath);
}

async function generateFallback2DEduSketch(promptText, outputPath) {
  const text = promptText.toLowerCase();
  let svgContent = "";

  if (
    text.includes("thuyền") ||
    text.includes("cọc") ||
    text.includes("sông") ||
    text.includes("chìm") ||
    text.includes("nước") ||
    text.includes("bạch đằng")
  ) {
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#74b9ff"/>
  <path d="M 0 450 Q 320 400 640 460 T 1280 430 L 1280 720 L 0 720 Z" fill="#0984e3"/>
  <path d="M 350 350 L 385 550 L 315 550 Z" fill="#2d3436" stroke="#000" stroke-width="8"/>
  <path d="M 650 320 L 688 550 L 612 550 Z" fill="#2d3436" stroke="#000" stroke-width="8"/>
  <g transform="translate(500, 300) rotate(20)">
    <path d="M -160 0 Q 0 90 160 0 L 130 -70 L -130 -70 Z" fill="#b2bec3" stroke="#000" stroke-width="10"/>
    <circle cx="60" cy="-40" r="22" fill="#fff" stroke="#000" stroke-width="6"/>
    <text x="48" y="-32" font-size="28" font-weight="bold">X X</text>
  </g>
  <rect x="50" y="30" width="1180" height="70" rx="15" fill="rgba(0,0,0,0.85)"/>
  <text x="640" y="75" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffeaa7" text-anchor="middle">
    ⛵ ${escapeXml(promptText.substring(0, 70))}...
  </text>
</svg>`;
  } else {
    svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#eef2f5"/>
  <line x1="0" y1="560" x2="1280" y2="560" stroke="#000" stroke-width="10"/>
  <g transform="translate(0, 20)">
    <ellipse cx="640" cy="270" rx="160" ry="140" fill="#ffffff" stroke="#000000" stroke-width="14"/>
    <circle cx="580" cy="240" r="16" fill="#000"/>
    <circle cx="700" cy="235" r="22" fill="#000"/>
    <path d="M 550 340 Q 640 430 730 330 Z" fill="#ff4757" stroke="#000" stroke-width="8"/>
    <path d="M 530 395 Q 480 600 450 680 L 830 680 Q 800 600 750 395 Z" fill="#3742fa" stroke="#000000" stroke-width="14"/>
  </g>
  <rect x="50" y="40" width="1180" height="80" rx="15" fill="#2ed573" stroke="#000" stroke-width="8"/>
  <text x="640" y="92" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#000000" text-anchor="middle">
    📚 ${escapeXml(promptText.substring(0, 70))}...
  </text>
</svg>`;
  }

  const pngPath = outputPath.endsWith(".png")
    ? outputPath
    : outputPath.replace(/\.[^.]+$/, ".png");
  const resvg = new Resvg(svgContent, {
    fitTo: { mode: "width", value: 1280 },
  });
  const pngBuffer = resvg.render().asPng();
  await fs.promises.writeFile(pngPath, pngBuffer);
  return pngPath;
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
    }
  });
}

module.exports = {
  parseScriptToScenes,
  generate2DImage,
  STYLE_PROMPT_PREFIX,
};
