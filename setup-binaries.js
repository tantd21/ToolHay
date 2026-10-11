const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

const BIN_DIR = path.join(__dirname, 'bin');
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure directories exist
if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';

const ytDlpPath = path.join(BIN_DIR, 'yt-dlp.exe');
const ffmpegPath = path.join(BIN_DIR, 'ffmpeg.exe');
const ffprobePath = path.join(BIN_DIR, 'ffprobe.exe');

function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        console.log(`Đang tải từ: ${url}...`);
        const file = fs.createWriteStream(destPath);
        https.get(url, (response) => {
            // Handle redirects (e.g. GitHub redirects)
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                file.close();
                fs.unlinkSync(destPath); // Remove incomplete file
                return downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(destPath);
                return reject(new Error(`Tải xuống thất bại với mã trạng thái: ${response.statusCode}`));
            }

            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`Đã tải xong: ${destPath}`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
}

function runPowerShell(cmd) {
    return new Promise((resolve, reject) => {
        exec(`powershell -Command "${cmd}"`, (error, stdout, stderr) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout);
            }
        });
    });
}

async function setup() {
    try {
        console.log('=== KHỞI ĐỘNG THIẾT LẬP MÔI TRƯỜNG ===');

        // 1. Tải yt-dlp.exe nếu chưa có
        if (!fs.existsSync(ytDlpPath)) {
            console.log('Chưa tìm thấy yt-dlp.exe. Đang bắt đầu tải...');
            await downloadFile(YT_DLP_URL, ytDlpPath);
            console.log('Tải thành công yt-dlp.exe!');
        } else {
            console.log('yt-dlp.exe đã tồn tại, bỏ qua bước tải.');
        }

        // 2. Tải ffmpeg + ffprobe nếu chưa có
        if (!fs.existsSync(ffmpegPath) || !fs.existsSync(ffprobePath)) {
            console.log('Chưa tìm thấy ffmpeg.exe hoặc ffprobe.exe. Đang bắt đầu tải bộ zip essentials...');
            const zipPath = path.join(TEMP_DIR, 'ffmpeg.zip');
            await downloadFile(FFMPEG_URL, zipPath);

            console.log('Đang giải nén bộ zip ffmpeg bằng PowerShell...');
            const extractDir = path.join(TEMP_DIR, 'ffmpeg_extracted');
            if (fs.existsSync(extractDir)) {
                fs.rmSync(extractDir, { recursive: true, force: true });
            }
            fs.mkdirSync(extractDir, { recursive: true });

            // Extract using PowerShell
            await runPowerShell(`Expand-Archive -Path '${zipPath}' -DestinationPath '${extractDir}' -Force`);
            console.log('Giải nén hoàn tất. Đang di chuyển các file thực thi...');

            // Find ffmpeg.exe and ffprobe.exe in the extracted directories (usually inside a nested folder)
            const findFiles = (dir) => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    if (fs.statSync(fullPath).isDirectory()) {
                        findFiles(fullPath);
                    } else if (file === 'ffmpeg.exe') {
                        fs.renameSync(fullPath, ffmpegPath);
                        console.log(`Đã di chuyển ffmpeg.exe vào thư mục bin.`);
                    } else if (file === 'ffprobe.exe') {
                        fs.renameSync(fullPath, ffprobePath);
                        console.log(`Đã di chuyển ffprobe.exe vào thư mục bin.`);
                    }
                }
            };
            findFiles(extractDir);

            // Cleanup temp
            console.log('Đang dọn dẹp các tệp tạm...');
            fs.rmSync(zipPath, { force: true });
            fs.rmSync(extractDir, { recursive: true, force: true });
            console.log('Dọn dẹp tệp tạm hoàn tất!');
        } else {
            console.log('ffmpeg.exe và ffprobe.exe đã tồn tại, bỏ qua bước tải.');
        }

        console.log('=== THIẾT LẬP MÔI TRƯỜNG THÀNH CÔNG! ===');
    } catch (e) {
        console.error('Đã xảy ra lỗi trong quá trình cài đặt:', e);
        process.exit(1);
    }
}

setup();
