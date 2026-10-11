const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { getFFmpegPath, getFFprobePath } = require('./video-builder');

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_b10c67e7ab79fb3c91837ea28977847b9cadbea787da3f0e';

const ELEVENLABS_VOICES = {
    eleven_jessica: 'cgSgspJ2msm6clMCkdW9',
    eleven_liam: 'TX3LPaxmHKxFdv7VOQHJ',
    eleven_brian: 'nPczCjzI2devNBz1zQrb'
};

/**
 * Tổng hợp giọng đọc TTS: Phân biệt rõ ràng Nam / Nữ và hỗ trợ ElevenLabs / Google Voice
 */
async function generateSpeech(text, voiceKey = 'hoaimy', outputPath) {
    if (voiceKey.startsWith('eleven_')) {
        try {
            return await generateElevenLabsSpeech(text, voiceKey, outputPath);
        } catch (e) {
            console.warn(`[ElevenLabs Fallback] Lỗi ElevenLabs: ${e.message}. Chuyển sang Google Voice...`);
            return generateGoogleTTS(text, voiceKey, outputPath);
        }
    } else {
        try {
            return await generateGoogleTTS(text, voiceKey, outputPath);
        } catch (e) {
            console.warn(`[Google TTS Fallback] Thử dùng ElevenLabs...`);
            return generateElevenLabsSpeech(text, 'eleven_jessica', outputPath);
        }
    }
}

/**
 * 1. Google Translate TTS với xử lý Giọng Nam / Nữ chuẩn
 */
async function generateGoogleTTS(text, voiceKey, outputPath) {
    const isMale = (voiceKey === 'namminh');
    console.log(`[TTS Google - ${isMale ? 'GIỌNG NAM' : 'GIỌNG NỮ'}] Đang tạo thoại: "${text.substring(0, 30)}..."`);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const tempRawAudio = path.join(dir, `raw_${Date.now()}.mp3`);
    const chunks = splitTextIntoChunks(text, 100);
    const audioBuffers = [];

    for (const chunk of chunks) {
        const encodedText = encodeURIComponent(chunk);
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=vi&client=tw-ob`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            throw new Error(`Google TTS Error: ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        audioBuffers.push(Buffer.from(arrayBuffer));
    }

    const finalBuffer = Buffer.concat(audioBuffers);
    await fs.promises.writeFile(tempRawAudio, finalBuffer);

    // Nếu chọn Giọng Nam (namminh), sử dụng FFmpeg hạ tông giọng (pitch shift down) trầm ấm nam tính
    if (isMale) {
        const ffmpegCmd = getFFmpegPath();
        const pitchCmd = `${ffmpegCmd} -y -i "${tempRawAudio}" -af "asetrate=24000*0.82,aresample=24000,atempo=1/0.82" "${outputPath}"`;
        await new Promise((resolve) => {
            exec(pitchCmd, (err) => {
                try { fs.unlinkSync(tempRawAudio); } catch(e) {}
                resolve();
            });
        });
    } else {
        // Giọng Nữ (hoaimy) giữ nguyên tần số gốc
        await fs.promises.rename(tempRawAudio, outputPath);
    }

    const duration = await getAudioDuration(outputPath, text);
    console.log(`[TTS Google - Thành công] ${outputPath} (${duration.toFixed(1)}s)`);
    return { outputPath, durationSeconds: duration };
}

/**
 * 2. ElevenLabs API (Premium)
 */
async function generateElevenLabsSpeech(text, voiceKey, outputPath) {
    const realVoiceId = ELEVENLABS_VOICES[voiceKey] || ELEVENLABS_VOICES.eleven_jessica;
    console.log(`[TTS ElevenLabs] Đang tạo giọng đọc với Voice ID: ${realVoiceId}`);

    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${realVoiceId}`, {
        method: 'POST',
        headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text: text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs API error (${response.status}): ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.promises.writeFile(outputPath, buffer);

    const duration = await getAudioDuration(outputPath, text);
    return { outputPath, durationSeconds: duration };
}

function splitTextIntoChunks(text, maxLength = 100) {
    const words = text.split(/\s+/);
    const chunks = [];
    let currentChunk = '';

    for (const word of words) {
        if ((currentChunk + ' ' + word).length <= maxLength) {
            currentChunk = currentChunk ? `${currentChunk} ${word}` : word;
        } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = word;
        }
    }
    if (currentChunk) chunks.push(currentChunk);
    return chunks;
}

function getAudioDuration(audioPath, text) {
    return new Promise((resolve) => {
        const ffprobeCmd = getFFprobePath();
        exec(`${ffprobeCmd} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${audioPath}"`, (err, stdout) => {
            if (!err && stdout.trim()) {
                const duration = parseFloat(stdout.trim());
                if (!isNaN(duration) && duration > 0) {
                    return resolve(duration);
                }
            }
            const wordsCount = text.trim().split(/\s+/).length;
            const estimatedDuration = Math.max(2.5, (wordsCount / 3.5) + 1.0);
            resolve(estimatedDuration);
        });
    });
}

module.exports = {
    generateSpeech,
    ELEVENLABS_VOICES
};
