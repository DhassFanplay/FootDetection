(async function () {
    // Smoothing helpers
    const smoothers = {
        left: { x: 0, y: 0 },
        right: { x: 0, y: 0 },
    };
    const smoothFactor = 0.8;

    async function startTracking() {
        await tf.setBackend('webgl');
        await tf.ready();
        console.log(`TF.js backend: ${tf.getBackend()}`);

        // Video setup
        const video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        video.style.display = "none";
        document.body.appendChild(video);

        // Overlay canvas
        const canvas = document.createElement("canvas");
        canvas.id = "movenet-overlay";
        canvas.style.position = "absolute";
        canvas.style.top = "0";
        canvas.style.left = "0";
        canvas.style.pointerEvents = "none";
        canvas.style.zIndex = "10";
        document.body.appendChild(canvas);
        const ctx = canvas.getContext("2d");

        function resizeCanvas() {
            const unityCanvas = document.getElementById("unity-canvas");
            if (!unityCanvas) return;
            canvas.width = unityCanvas.clientWidth;
            canvas.height = unityCanvas.clientHeight;
            canvas.style.width = unityCanvas.style.width;
            canvas.style.height = unityCanvas.style.height;
        }

        window.addEventListener("resize", resizeCanvas);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = stream;
            await new Promise(resolve => video.onloadedmetadata = resolve);
            video.play();
        } catch (err) {
            console.error("Camera access failed:", err);
            return;
        }

        resizeCanvas();

        // Load MoveNet detector
        const detector = await window.poseDetection.createDetector(
            window.poseDetection.SupportedModels.MoveNet,
            {
                modelType: window.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
            }
        );

        console.log("MoveNet detector loaded");

        async function detectPoseLoop() {
            const poses = await detector.estimatePoses(video);
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (poses.length > 0) {
                const keypoints = poses[0].keypoints;
                const leftAnkle = keypoints.find(p => p.name === 'left_ankle');
                const rightAnkle = keypoints.find(p => p.name === 'right_ankle');

                const drawFoot = (point, color, label) => {
                    if (point && point.score > 0.4) {
                        // Mirror X for webcam view
                        let rawX = point.x / video.videoWidth * canvas.width;
                        let rawY = point.y / video.videoHeight * canvas.height;
                        let sx = (1 - point.x / video.videoWidth) * canvas.width;
                        let sy = rawY;

                        // Smoothing
                        const smooth = smoothers[label];
                        sx = smooth.x = smooth.x * smoothFactor + sx * (1 - smoothFactor);
                        sy = smooth.y = smooth.y * smoothFactor + sy * (1 - smoothFactor);

                        // Draw circle
                        ctx.beginPath();
                        ctx.arc(sx, sy, 6, 0, 2 * Math.PI);
                        ctx.fillStyle = color;
                        ctx.fill();

                        ctx.font = "14px Arial";
                        ctx.fillStyle = "white";
                        ctx.fillText(`${label}: (${sx.toFixed(0)},${sy.toFixed(0)})`, sx + 10, sy);

                        // Send to Unity in normalized format (0-1)
                        const normX = (sx / canvas.width).toFixed(4);
                        const normY = (sy / canvas.height).toFixed(4);
                        const posStr = `${normX},${normY}`;

                        if (typeof unityInstance !== "undefined") {
                            if (label === "right") {
                                unityInstance.SendMessage("FootReceiver", "ReceiveRightFootData", posStr);
                            } else {
                                unityInstance.SendMessage("FootReceiver", "ReceiveLeftFootData", posStr);
                            }
                        }
                    }
                };

                drawFoot(leftAnkle, "blue", "left");
                drawFoot(rightAnkle, "red", "right");
            }

            setTimeout(() => requestAnimationFrame(detectPoseLoop), 33); // ~30fps
        }

        detectPoseLoop();
    }

    window.addEventListener("load", () => {
        if (window.tf && window.poseDetection) {
            startTracking();
        } else {
            console.error("TensorFlow.js or MoveNet not loaded.");
        }
    });
})();
