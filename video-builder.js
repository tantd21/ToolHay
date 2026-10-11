const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { Resvg } = require('@resvg/resvg-js');

function getFFmpegPath() {
    const localBin = path.join(__dirname, 'bin', 'ffmpeg.exe');
    if (fs.existsSync(localBin)) return `"${localBin}"`;
    const toolhayBin = path.join(__dirname, '..', 'Toolhay', 'bin', 'ffmpeg.exe');
    if (fs.existsSync(toolhayBin)) return `"${toolhayBin}"`;
    return 'ffmpeg';
}

function getFFprobePath() {
    const localBin = path.join(__dirname, 'bin', 'ffprobe.exe');
    if (fs.existsSync(localBin)) return `"${localBin}"`;
    const toolhayBin = path.join(__dirname, '..', 'Toolhay', 'bin', 'ffprobe.exe');
    if (fs.existsSync(toolhayBin)) return `"${toolhayBin}"`;
    return 'ffprobe';
}

/**
 * Đảm bảo file ảnh đầu vào là PNG chuẩn cho FFmpeg
 */
async function ensurePngImagePath(imagePath) {
    if (imagePath.endsWith('.svg')) {
        const pngPath = imagePath.replace(/\.svg$/i, '.png');
        if (!fs.existsSync(pngPath)) {
            const svgContent = await fs.promises.readFile(imagePath, 'utf-8');
            const resvg = new Resvg(svgContent, { fitTo: { mode: 'width', value: 1280 } });
            const pngBuffer = resvg.render().asPng();
            await fs.promises.writeFile(pngPath, pngBuffer);
        }
        return pngPath;
    }
    return imagePath;
}

/**
 * Ghép các cảnh (scenes) thành video MP4 HOẠT HÌNH 2D CHUYỂN ĐỘNG
 */
async function buildVideoFromScenes(scenes, finalOutputPath, options = { aspectRatio: "16:9" }) {
    const ffmpegCmd = getFFmpegPath();
    console.log(`[Video Builder] Bắt đầu ghép video hoạt hình 2D (${scenes.length} cảnh) dùng FFmpeg: ${ffmpegCmd}...`);

    const tempDir = path.join(path.dirname(finalOutputPath), 'temp_build');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const sceneVideoPaths = [];

    for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const sceneVideoPath = path.join(tempDir, `scene_${i + 1}.mp4`);
        console.log(`[Video Builder] Render Hoạt Hình Cảnh ${i + 1}/${scenes.length}: ${scene.dialogue.substring(0, 30)}...`);

        await renderSingleAnimatedScene(scene, sceneVideoPath, options);
        sceneVideoPaths.push(sceneVideoPath);
    }

    const concatFilePath = path.join(tempDir, 'concat_list.txt');
    const concatFileContent = sceneVideoPaths
        .map(p => `file '${p.replace(/\\/g, '/')}'`)
        .join('\n');
    await fs.promises.writeFile(concatFilePath, concatFileContent, 'utf-8');

    console.log(`[Video Builder] Ghép tất cả các cảnh hoạt hình thành video hoàn chỉnh: ${finalOutputPath}`);
    const concatCmd = `${ffmpegCmd} -y -f concat -safe 0 -i "${concatFilePath}" -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 192k "${finalOutputPath}"`;

    return new Promise((resolve, reject) => {
        exec(concatCmd, (err, stdout, stderr) => {
            if (err) {
                console.error('[Video Builder] Lỗi khi concat video:', stderr);
                return reject(err);
            }
            console.log(`[Video Builder] Xuất video hoạt hình 2D thành công: ${finalOutputPath}`);
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
            resolve(finalOutputPath);
        });
    });
}

/**
 * Render một cảnh hoạt hình 2D từ chuỗi khung hình chuyển động (Animation Keyframe Sequence)
 */
async function renderSingleAnimatedScene(scene, outputPath, options) {
    const ffmpegCmd = getFFmpegPath();
    const { imagePath, audioPath, durationSeconds, framePattern, fps = 8 } = scene;
    const duration = Math.max(2.0, durationSeconds || 3.0);

    const width = options.aspectRatio === "9:16" ? 720 : 1280;
    const height = options.aspectRatio === "9:16" ? 1280 : 720;

    // Chuyển đổi SVG sang PNG nếu cần
    const safePngPath = await ensurePngImagePath(imagePath);

    return new Promise((resolve, reject) => {
        // Nếu cảnh có chuỗi khung hình PNG hoạt hình
        if (framePattern && fs.existsSync(path.dirname(framePattern))) {
            const animCmd = `${ffmpegCmd} -y -framerate ${fps} -i "${framePattern}" -i "${audioPath}" -vf "scale=${width}:${height}" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "${outputPath}"`;
            
            exec(animCmd, (err) => {
                if (!err) {
                    return resolve(outputPath);
                }
                console.warn('[Video Builder] Lỗi render chuỗi PNG animation, dùng fallback PNG...');
                renderStaticSceneFallback(ffmpegCmd, safePngPath, audioPath, duration, width, height, outputPath, resolve, reject);
            });
        } else {
            renderStaticSceneFallback(ffmpegCmd, safePngPath, audioPath, duration, width, height, outputPath, resolve, reject);
        }
    });
}

function renderStaticSceneFallback(ffmpegCmd, imagePath, audioPath, duration, width, height, outputPath, resolve, reject) {
    const simpleCmd = `${ffmpegCmd} -y -loop 1 -i "${imagePath}" -i "${audioPath}" -c:v libx264 -t ${duration} -vf "scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2" -pix_fmt yuv420p -c:a aac -shortest "${outputPath}"`;
    exec(simpleCmd, (err) => {
        if (err) return reject(err);
        resolve(outputPath);
    });
}

module.exports = {
    buildVideoFromScenes,
    getFFmpegPath,
    getFFprobePath
};
