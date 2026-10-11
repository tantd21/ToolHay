const express = require('express');
const path = require('path');
const fs = require('fs');

const gemini = require('./gemini');
const tts = require('./tts');
const animator = require('./animator');
const videoBuilder = require('./video-builder');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(express.static(path.join(__dirname, 'public')));
app.use('/outputs', express.static(path.join(__dirname, 'outputs')));

const outputDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

/**
 * API 1: Phân tích kịch bản -> Mảng phân cảnh (Scenes)
 */
app.post('/api/parse-script', async (req, res) => {
    try {
        const { script } = req.body;
        if (!script || !script.trim()) {
            return res.status(400).json({ error: 'Kịch bản không được để trống' });
        }

        console.log('[Server] Nhận kịch bản:', script.substring(0, 50) + '...');
        const scenes = await gemini.parseScriptToScenes(script);
        res.json({ success: true, scenes });
    } catch (err) {
        console.error('[Server Error] parse-script:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * API 2: Sinh Media & Chuỗi Hoạt Hình 2D Chuyển Động cho Phân Cảnh
 */
app.post('/api/generate-scene-media', async (req, res) => {
    try {
        const { sceneId, dialogue, imagePrompt, voiceKey = 'namminh' } = req.body;
        const timestamp = Date.now();
        
        const imagePath = path.join(outputDir, `scene_${sceneId}_${timestamp}.png`);
        const audioPath = path.join(outputDir, `audio_${sceneId}_${timestamp}.mp3`);

        // 1. Sinh audio TTS tiếng Việt (Phân biệt rõ Nam Minh / Hoài Mỹ)
        const ttsResult = await tts.generateSpeech(dialogue, voiceKey, audioPath);

        // 2. Sinh ảnh đại diện 2D
        const generatedImgPath = await gemini.generate2DImage(imagePrompt || dialogue, imagePath);

        // 3. ĐỘNG CƠ HOẠT HÌNH 2D: Sinh chuỗi khung hình chuyển động (Animation Keyframes)
        const animResult = await animator.generateSceneAnimationFrames(
            sceneId,
            imagePrompt || dialogue,
            dialogue,
            ttsResult.durationSeconds,
            outputDir
        );

        const imgUrl = `/outputs/${path.basename(generatedImgPath)}`;
        const audioUrl = `/outputs/${path.basename(ttsResult.outputPath)}`;

        res.json({
            success: true,
            sceneId,
            imagePath: generatedImgPath,
            audioPath: ttsResult.outputPath,
            imageUrl: imgUrl,
            audioUrl: audioUrl,
            durationSeconds: ttsResult.durationSeconds,
            framePattern: animResult.framePattern,
            fps: animResult.fps
        });
    } catch (err) {
        console.error('[Server Error] generate-scene-media:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * API 3: Ghép tất cả các cảnh thành video MP4 HOẠT HÌNH 2D hoàn chỉnh
 */
app.post('/api/render-video', async (req, res) => {
    try {
        const { scenes, aspectRatio = "16:9" } = req.body;
        if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
            return res.status(400).json({ error: 'Danh sách cảnh không hợp lệ' });
        }

        const timestamp = Date.now();
        const finalVideoPath = path.join(outputDir, `animation_video_${timestamp}.mp4`);

        const videoPath = await videoBuilder.buildVideoFromScenes(scenes, finalVideoPath, { aspectRatio });
        const videoUrl = `/outputs/${path.basename(videoPath)}`;

        res.json({
            success: true,
            videoUrl: videoUrl,
            videoPath: videoPath
        });
    } catch (err) {
        console.error('[Server Error] render-video:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`=================================================`);
    console.log(`🚀 Toolhay2 2D Animation Generator Studio Running!`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`=================================================`);
});
