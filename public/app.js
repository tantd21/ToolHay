document.addEventListener('DOMContentLoaded', () => {
    const scriptInput = document.getElementById('scriptInput');
    const voiceSelect = document.getElementById('voiceSelect');
    const aspectRatioSelect = document.getElementById('aspectRatioSelect');
    const btnProcessScript = document.getElementById('btnProcessScript');
    
    const fileInput = document.getElementById('fileInput');
    const dropZone = document.getElementById('dropZone');
    const dropHint = document.getElementById('dropHint');

    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingStatusText = document.getElementById('loadingStatusText');
    const btnCancelTask = document.getElementById('btnCancelTask');
    
    const scenesSection = document.getElementById('scenesSection');
    const scenesContainer = document.getElementById('scenesContainer');
    const btnRenderVideo = document.getElementById('btnRenderVideo');
    
    const resultSection = document.getElementById('resultSection');
    const finalVideoPlayer = document.getElementById('finalVideoPlayer');
    const downloadVideoBtn = document.getElementById('downloadVideoBtn');

    let currentScenes = [];
    let activeAbortController = null;

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            readAndSetScriptFile(file);
        }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('drag-over');
            dropHint.classList.remove('hidden');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('drag-over');
            dropHint.classList.add('hidden');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            readAndSetScriptFile(files[0]);
        }
    });

    function readAndSetScriptFile(file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            scriptInput.value = content;
            alert(`✅ Đã Import file kịch bản thành công: "${file.name}" (${file.size} bytes)`);
        };
        reader.onerror = () => {
            alert('❌ Lỗi khi đọc file kịch bản!');
        };
        reader.readAsText(file, 'UTF-8');
    }

    document.querySelectorAll('.btn-sample').forEach(btn => {
        btn.addEventListener('click', () => {
            const topic = btn.getAttribute('data-topic');
            if (topic) {
                scriptInput.value = topic;
                scriptInput.focus();
            }
        });
    });

    btnCancelTask.addEventListener('click', () => {
        if (activeAbortController) {
            activeAbortController.abort();
            activeAbortController = null;
        }
        hideLoading();
        alert('⏹️ Đã dừng tác vụ theo yêu cầu của bạn!');
    });

    btnProcessScript.addEventListener('click', async () => {
        const scriptText = scriptInput.value.trim();
        if (!scriptText) {
            alert('Vui lòng nhập kịch bản hoặc chọn Import file kịch bản trước khi tiếp tục!');
            return;
        }

        activeAbortController = new AbortController();
        const signal = activeAbortController.signal;

        showLoading('Gemini AI đang phân cảnh và tạo Hoạt Hình 2D Chuyển Động...');
        scenesSection.classList.add('hidden');
        resultSection.classList.add('hidden');
        scenesContainer.innerHTML = '';
        currentScenes = [];

        try {
            const parseRes = await fetch('/api/parse-script', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script: scriptText }),
                signal: signal
            });

            const parseData = await parseRes.json();
            if (!parseData.success) {
                throw new Error(parseData.error || 'Lỗi khi phân tích kịch bản');
            }

            const rawScenes = parseData.scenes;
            console.log(`Đã phân tích xong kịch bản (${rawScenes.length} cảnh):`, rawScenes);

            for (let i = 0; i < rawScenes.length; i++) {
                const scene = rawScenes[i];
                updateLoadingText(`Đang dựng Hoạt hình 2D & Thuyết minh Cảnh ${i + 1}/${rawScenes.length}...`);

                const mediaRes = await fetch('/api/generate-scene-media', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        sceneId: scene.sceneId || (i + 1),
                        dialogue: scene.dialogue,
                        imagePrompt: scene.imagePrompt,
                        voiceKey: voiceSelect.value
                    }),
                    signal: signal
                });

                const mediaData = await mediaRes.json();
                if (!mediaData.success) {
                    throw new Error(mediaData.error || `Lỗi khi tạo media cảnh ${i + 1}`);
                }

                currentScenes.push({
                    sceneId: scene.sceneId || (i + 1),
                    dialogue: scene.dialogue,
                    characterExpression: scene.characterExpression || 'giáo viên derpy',
                    imagePrompt: scene.imagePrompt,
                    imagePath: mediaData.imagePath,
                    audioPath: mediaData.audioPath,
                    imageUrl: mediaData.imageUrl,
                    audioUrl: mediaData.audioUrl,
                    durationSeconds: mediaData.durationSeconds,
                    framePattern: mediaData.framePattern,
                    fps: mediaData.fps
                });
            }

            hideLoading();
            renderSceneCards(currentScenes);
            scenesSection.classList.remove('hidden');

        } catch (err) {
            hideLoading();
            if (err.name === 'AbortError') {
                console.log('Tác vụ bị hủy bởi người dùng');
            } else {
                alert(`Lỗi: ${err.message}`);
                console.error('Lỗi quy trình:', err);
            }
        }
    });

    function renderSceneCards(scenes) {
        scenesContainer.innerHTML = '';
        
        const totalSec = scenes.reduce((acc, cur) => acc + (cur.durationSeconds || 3), 0);
        const mins = Math.floor(totalSec / 60);
        const secs = Math.round(totalSec % 60);
        
        const summaryBadge = document.createElement('div');
        summaryBadge.className = 'timeline-summary-bar';
        summaryBadge.innerHTML = `🎬 <strong>Hoạt Hình 2D Chuyển Động:</strong> ${scenes.length} cảnh &nbsp;|&nbsp; ⏱️ <strong>Tổng thời lượng:</strong> ${mins} phút ${secs} giây`;
        scenesContainer.appendChild(summaryBadge);

        scenes.forEach((scene, index) => {
            const card = document.createElement('div');
            card.className = 'scene-card';
            card.innerHTML = `
                <div class="scene-header">
                    <span class="scene-badge">Cảnh ${index + 1} (${scene.durationSeconds ? scene.durationSeconds.toFixed(1) + 's' : ''})</span>
                    <span class="expression-tag">🎬 2D Animation Mode</span>
                </div>
                <img class="scene-img-preview" src="${scene.imageUrl}" alt="Cảnh ${index + 1}" />
                <div class="scene-body">
                    <div class="dialogue-box">🗣️ "${scene.dialogue}"</div>
                    <audio controls src="${scene.audioUrl}"></audio>
                </div>
            `;
            scenesContainer.appendChild(card);
        });
    }

    btnRenderVideo.addEventListener('click', async () => {
        if (currentScenes.length === 0) {
            alert('Chưa có cảnh nào để ghép video!');
            return;
        }

        activeAbortController = new AbortController();
        const signal = activeAbortController.signal;

        showLoading('FFmpeg đang render chuỗi Hoạt Hình 2D Chuyển Động & Phụ Đề...');

        try {
            const res = await fetch('/api/render-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    scenes: currentScenes,
                    aspectRatio: aspectRatioSelect.value
                }),
                signal: signal
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'Lỗi khi xuất video MP4');
            }

            hideLoading();
            resultSection.classList.remove('hidden');
            finalVideoPlayer.src = data.videoUrl;
            downloadVideoBtn.href = data.videoUrl;
            
            resultSection.scrollIntoView({ behavior: 'smooth' });

        } catch (err) {
            hideLoading();
            if (err.name === 'AbortError') {
                console.log('Tác vụ ghép video bị hủy bởi người dùng');
            } else {
                alert(`Lỗi khi ghép video: ${err.message}`);
            }
        }
    });

    function showLoading(text) {
        loadingStatusText.textContent = text;
        loadingOverlay.classList.remove('hidden');
    }

    function updateLoadingText(text) {
        loadingStatusText.textContent = text;
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
        activeAbortController = null;
    }
});
