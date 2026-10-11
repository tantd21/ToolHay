const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

/**
 * Động Cơ Hoạt Hình 2D (2D Animation Frame Engine)
 * Tạo chuỗi khung hình PNG chuyển động (Animated PNG Keyframe Sequence) cho từng cảnh
 */
async function generateSceneAnimationFrames(sceneId, promptText, dialogue, durationSeconds = 5, outputDir) {
    const text = (promptText + " " + dialogue).toLowerCase();
    const fps = 8;
    const totalFrames = Math.max(16, Math.ceil(durationSeconds * fps));
    
    const sceneFramesDir = path.join(outputDir, `scene_${sceneId}_frames`);
    if (!fs.existsSync(sceneFramesDir)) {
        fs.mkdirSync(sceneFramesDir, { recursive: true });
    }

    console.log(`[2D Animator] Đang vẽ ${totalFrames} khung hình PNG hoạt hình 2D cho Cảnh ${sceneId}...`);

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
        const progress = frameIndex / (totalFrames - 1);
        const frameFileName = `frame_${String(frameIndex + 1).padStart(4, '0')}.png`;
        const framePath = path.join(sceneFramesDir, frameFileName);

        let svgContent = '';

        if (text.includes('thuyền') || text.includes('cọc') || text.includes('sông') || text.includes('chìm') || text.includes('nước') || text.includes('đầm') || text.includes('bạch đằng')) {
            svgContent = drawAnimatedRiverSpikeScene(dialogue, progress, frameIndex);
        } else if (text.includes('tên') || text.includes('lửa') || text.includes('cháy') || text.includes('bắn') || text.includes('quân') || text.includes('binh') || text.includes('nghênh chiến')) {
            svgContent = drawAnimatedFireArrowScene(dialogue, progress, frameIndex);
        } else if (text.includes('vua') || text.includes('hoàng') || text.includes('ngơ ngác') || text.includes('khóc') || text.includes('gục') || text.includes('thái thú') || text.includes('chủ quan')) {
            svgContent = drawAnimatedCryingKingScene(dialogue, progress, frameIndex);
        } else if (text.includes('mừng') || text.includes('thắng') || text.includes('độc lập') || text.includes('vui') || text.includes('hân hoan') || text.includes('kỷ nguyên')) {
            svgContent = drawAnimatedVictoryScene(dialogue, progress, frameIndex);
        } else {
            svgContent = drawAnimatedGeneralScene(dialogue, progress, frameIndex);
        }

        // Chuyển đổi SVG thành PNG chuẩn bằng Resvg WASM/Native
        const resvg = new Resvg(svgContent, {
            fitTo: { mode: 'width', value: 1280 }
        });
        const pngBuffer = resvg.render().asPng();
        await fs.promises.writeFile(framePath, pngBuffer);
    }

    return {
        sceneFramesDir,
        framePattern: path.join(sceneFramesDir, 'frame_%04d.png'),
        totalFrames,
        fps
    };
}

// === SCENE 1: HOẠT HÌNH THUYỀN DI CHUYỂN & ĐÂM VÀO CỌC NHỌN ===
function drawAnimatedRiverSpikeScene(dialogue, progress, frameIndex) {
    const waveOffset = (frameIndex * 12) % 100;
    const shipX = -150 + progress * 700;
    const isCrashing = progress > 0.45;
    const crashAngle = isCrashing ? Math.min(40, (progress - 0.45) * 120) : 0;
    const crashSink = isCrashing ? (progress - 0.45) * 180 : 0;
    const waterY = 430 + progress * 80;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#74b9ff"/>
  <ellipse cx="${(200 + frameIndex * 5) % 1400 - 100}" cy="120" rx="90" ry="40" fill="#ffffff" opacity="0.9"/>
  <ellipse cx="${(800 + frameIndex * 8) % 1400 - 100}" cy="90" rx="130" ry="50" fill="#ffffff" opacity="0.9"/>

  <g transform="translate(0, 0)">
    <path d="M 350 ${waterY - 80} L 385 ${waterY + 120} L 315 ${waterY + 120} Z" fill="#2d3436" stroke="#000" stroke-width="8"/>
    <path d="M 650 ${waterY - 110} L 688 ${waterY + 120} L 612 ${waterY + 120} Z" fill="#2d3436" stroke="#000" stroke-width="8"/>
    <path d="M 950 ${waterY - 90} L 985 ${waterY + 120} L 915 ${waterY + 120} Z" fill="#2d3436" stroke="#000" stroke-width="8"/>
  </g>

  <g transform="translate(${shipX}, ${320 + crashSink}) rotate(${crashAngle})">
    <path d="M -160 0 Q 0 90 160 0 L 130 -70 L -130 -70 Z" fill="#b2bec3" stroke="#000" stroke-width="10"/>
    <line x1="0" y1="-70" x2="0" y2="-200" stroke="#000" stroke-width="10"/>
    <path d="M 0 -200 L 90 -140 L 0 -110 Z" fill="#ff7675" stroke="#000" stroke-width="6"/>
    <circle cx="60" cy="-40" r="22" fill="#fff" stroke="#000" stroke-width="6"/>
    <text x="48" y="-32" font-size="28" font-weight="bold">${isCrashing ? 'X X' : 'O O'}</text>
    <path d="M 40 -10 L ${isCrashing ? '10 -60' : '80 -40'}" stroke="#000" stroke-width="8" stroke-linecap="round"/>
  </g>

  <path d="M ${-100 + waveOffset} ${waterY} Q ${100 + waveOffset} ${waterY - 30} ${300 + waveOffset} ${waterY} T ${700 + waveOffset} ${waterY} T ${1100 + waveOffset} ${waterY} T ${1500 + waveOffset} ${waterY} L 1500 720 L -100 720 Z" fill="#0984e3"/>

  ${isCrashing ? `
    <path d="M ${shipX + 100} ${waterY - 20} Q ${shipX + 130} ${waterY - 90} ${shipX + 160} ${waterY - 10}" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M ${shipX + 40} ${waterY - 20} Q ${shipX + 10} ${waterY - 110} ${shipX - 20} ${waterY - 10}" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round"/>
  ` : ''}

  <rect x="40" y="30" width="1200" height="70" rx="15" fill="rgba(0,0,0,0.85)"/>
  <text x="640" y="75" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffeaa7" text-anchor="middle">
    ⛵ ${escapeXml(dialogue)}
  </text>
</svg>`;
}

// === SCENE 2: MƯA TÊN LỬA ===
function drawAnimatedFireArrowScene(dialogue, progress, frameIndex) {
    const arrowOffsetX = (frameIndex * 45) % 800;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#d63031"/>
  <rect x="0" y="520" width="1280" height="200" fill="#2d3436"/>

  <path d="M 300 530 Q ${350 + (frameIndex % 3) * 15} ${320 - (frameIndex % 4) * 20} 400 530 Q ${450 - (frameIndex % 3) * 10} ${300 - (frameIndex % 2) * 30} 500 530" fill="#fdcb6e" stroke="#e17055" stroke-width="10"/>

  <g opacity="0.9">
    <line x1="${-200 + arrowOffsetX}" y1="120" x2="${200 + arrowOffsetX}" y2="280" stroke="#000" stroke-width="10"/>
    <polygon points="${200 + arrowOffsetX},280 ${170 + arrowOffsetX},250 ${160 + arrowOffsetX},290" fill="#ff7675"/>
    
    <line x1="${-100 + arrowOffsetX}" y1="200" x2="${300 + arrowOffsetX}" y2="360" stroke="#000" stroke-width="10"/>
    <polygon points="${300 + arrowOffsetX},360 ${270 + arrowOffsetX},330 ${260 + arrowOffsetX},370" fill="#ff7675"/>

    <line x1="${100 + arrowOffsetX}" y1="80" x2="${500 + arrowOffsetX}" y2="240" stroke="#000" stroke-width="10"/>
    <polygon points="${500 + arrowOffsetX},240 ${470 + arrowOffsetX},210 ${460 + arrowOffsetX},250" fill="#ff7675"/>
  </g>

  <g transform="translate(180, 360)">
    <circle cx="0" cy="0" r="35" fill="#fff" stroke="#000" stroke-width="8"/>
    <circle cx="-10" cy="-5" r="5" fill="#000"/><circle cx="10" cy="-5" r="5" fill="#000"/>
    <path d="M -15 15 Q 0 25 15 15" fill="none" stroke="#000" stroke-width="6"/>
    <path d="M -30 35 L 30 35 L 20 150 L -20 150 Z" fill="#0984e3" stroke="#000" stroke-width="8"/>
    <path d="M 30 50 L ${80 - (frameIndex % 2) * 15} ${20 + (frameIndex % 2) * 10}" stroke="#000" stroke-width="10" stroke-linecap="round"/>
  </g>

  <rect x="40" y="30" width="1200" height="70" rx="15" fill="rgba(0,0,0,0.85)"/>
  <text x="640" y="75" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ff7675" text-anchor="middle">
    🏹 ${escapeXml(dialogue)}
  </text>
</svg>`;
}

// === SCENE 3: VUA KHÓC ===
function drawAnimatedCryingKingScene(dialogue, progress, frameIndex) {
    const tearY = (frameIndex * 20) % 180;
    const crownAngle = Math.sin(frameIndex * 0.5) * 10;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#fdcb6e"/>
  <line x1="0" y1="560" x2="1280" y2="560" stroke="#000" stroke-width="12"/>

  <g transform="translate(640, 360)">
    <g transform="rotate(${crownAngle})">
      <path d="M -60 -180 L -30 -230 L 0 -190 L 30 -230 L 60 -180 Z" fill="#f1c40f" stroke="#000" stroke-width="8"/>
    </g>

    <circle cx="0" cy="-80" r="90" fill="#fff" stroke="#000" stroke-width="12"/>
    <text x="-50" y="-70" font-size="50" font-weight="bold">X</text>
    <text x="10" y="-70" font-size="50" font-weight="bold">X</text>

    <circle cx="-45" cy="${-30 + tearY}" r="12" fill="#74b9ff"/>
    <circle cx="45" cy="${-30 + tearY}" r="12" fill="#74b9ff"/>

    <ellipse cx="0" cy="-10" rx="${30 + (frameIndex % 2) * 8}" ry="${20 + (frameIndex % 2) * 5}" fill="#000"/>
    <path d="M -70 10 Q -120 180 -140 200 L 140 200 Q 120 180 70 10 Z" fill="#e74c3c" stroke="#000" stroke-width="12"/>
  </g>

  <rect x="40" y="30" width="1200" height="70" rx="15" fill="rgba(0,0,0,0.85)"/>
  <text x="640" y="75" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="middle">
    😭 ${escapeXml(dialogue)}
  </text>
</svg>`;
}

// === SCENE 4: ĂN MỪNG ===
function drawAnimatedVictoryScene(dialogue, progress, frameIndex) {
    const jumpY = Math.abs(Math.sin(frameIndex * 0.6)) * 40;
    const flagAngle = Math.sin(frameIndex * 0.4) * 20;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#55efc4"/>
  <circle cx="640" cy="180" r="100" fill="#ffeaa7" stroke="#000" stroke-width="8"/>
  <line x1="0" y1="560" x2="1280" y2="560" stroke="#000" stroke-width="12"/>

  <g transform="translate(420, ${380 - jumpY})">
    <circle cx="0" cy="-80" r="60" fill="#fff" stroke="#000" stroke-width="10"/>
    <circle cx="-20" cy="-90" r="8" fill="#000"/><circle cx="20" cy="-90" r="8" fill="#000"/>
    <path d="M -30 -60 Q 0 -20 30 -60" fill="none" stroke="#000" stroke-width="8"/>
    <path d="M -40 -20 L 40 -20 L 30 180 L -30 180 Z" fill="#0984e3" stroke="#000" stroke-width="10"/>
    <g transform="rotate(${flagAngle})">
      <line x1="30" y1="10" x2="120" y2="-90" stroke="#000" stroke-width="10"/>
      <path d="M 120 -90 L 190 -60 L 120 -30 Z" fill="#d63031" stroke="#000" stroke-width="6"/>
    </g>
  </g>

  <g transform="translate(860, ${380 - (40 - jumpY)})">
    <circle cx="0" cy="-80" r="60" fill="#fff" stroke="#000" stroke-width="10"/>
    <circle cx="-20" cy="-90" r="8" fill="#000"/><circle cx="20" cy="-90" r="8" fill="#000"/>
    <ellipse cx="0" cy="-55" rx="15" ry="20" fill="#000"/>
    <path d="M -40 -20 L 40 -20 L 30 180 L -30 180 Z" fill="#6c5ce7" stroke="#000" stroke-width="10"/>
  </g>

  <rect x="40" y="30" width="1200" height="70" rx="15" fill="rgba(0,0,0,0.85)"/>
  <text x="640" y="75" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#55efc4" text-anchor="middle">
    🎉 ${escapeXml(dialogue)}
  </text>
</svg>`;
}

// === SCENE 5: CẢNH CHUNG ===
function drawAnimatedGeneralScene(dialogue, progress, frameIndex) {
    const talkMouthRy = 8 + (frameIndex % 3) * 6;
    const handAngle = Math.sin(frameIndex * 0.5) * 15;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#eef2f5"/>
  <line x1="0" y1="560" x2="1280" y2="560" stroke="#000" stroke-width="10"/>

  <g transform="translate(640, 360)">
    <circle cx="0" cy="-80" r="90" fill="#fff" stroke="#000" stroke-width="12"/>
    <circle cx="-30" cy="-90" r="10" fill="#000"/><circle cx="30" cy="-90" r="14" fill="#000"/>
    <ellipse cx="0" cy="-30" rx="25" ry="${talkMouthRy}" fill="#ff4757" stroke="#000" stroke-width="6"/>

    <path d="M -60 10 Q -100 180 -120 200 L 120 200 Q 100 180 60 10 Z" fill="#3742fa" stroke="#000" stroke-width="12"/>

    <g transform="rotate(${handAngle})">
      <path d="M 60 40 L 160 -10" stroke="#000" stroke-width="12" stroke-linecap="round"/>
    </g>
  </g>

  <rect x="40" y="30" width="1200" height="70" rx="15" fill="rgba(0,0,0,0.85)"/>
  <text x="640" y="75" font-family="Arial, sans-serif" font-size="26" font-weight="bold" fill="#ffffff" text-anchor="middle">
    💬 ${escapeXml(dialogue)}
  </text>
</svg>`;
}

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

module.exports = {
    generateSceneAnimationFrames
};
