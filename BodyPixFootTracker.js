(async function () {
    async function startTracking() {
        await tf.ready();
        await tf.setBackend('webgl');
        console.log(`TF.js backend: ${tf.getBackend()}`);

        const video = document.createElement("video");
        video.setAttribute("autoplay", "");
        video.setAttribute("playsinline", "");
        video.style.position = "absolute";
        video.style.top = "0";
        video.style.left = "0";
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.zIndex = "-1";
        document.body.appendChild(video);

        const canvas = document.createElement("canvas");
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
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { exact: "environment" } }
            });
            video.srcObject = stream;
            await new Promise((resolve) => (video.onloadedmetadata = resolve));
            video.play();
        } catch (err) {
            console.error("Camera error:", err);
            return;
        }


        const net = await bodyPix.load();
        resizeCanvas();

        async function detectFeetLoop() {
            const segmentation = await net.segmentPersonParts(video, {
                flipHorizontal: false,
                internalResolution: 'medium',
            });

            const partIds = { right: 18, left: 19 };
            const footPixels = { right: [], left: [] };

            const segWidth = segmentation.width;
            const segHeight = segmentation.height;

            segmentation.data.forEach((partId, index) => {
                const xIndex = index % segWidth;
                const yIndex = Math.floor(index / segWidth);
                const x = (xIndex / segWidth) * canvas.width;
                const y = (yIndex / segHeight) * canvas.height;

                if (partId === partIds.right) footPixels.right.push({ x, y });
                else if (partId === partIds.left) footPixels.left.push({ x, y });
            });

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (const foot of ['left', 'right']) {
                const pixels = footPixels[foot];
                if (pixels.length > 0) {
                    const avgX = pixels.reduce((sum, p) => sum + p.x, 0) / pixels.length;
                    const avgY = pixels.reduce((sum, p) => sum + p.y, 0) / pixels.length;

                    ctx.beginPath();
                    ctx.arc(avgX, avgY, 6, 0, 2 * Math.PI);
                    ctx.fillStyle = foot === 'left' ? 'blue' : 'red';
                    ctx.fill();

                    ctx.font = "14px Arial";
                    ctx.fillStyle = "white";
                    ctx.fillText(`${foot} (${avgX.toFixed(0)},${avgY.toFixed(0)})`, avgX + 10, avgY);

                    if (typeof unityInstance !== "undefined") {
                        const normX = (avgX / canvas.width).toFixed(4);
                        const normY = (avgY / canvas.height).toFixed(4);
                        const pos = `${normX},${normY}`;
                        const methodName = foot === 'left' ? "ReceiveLeftFootData" : "ReceiveRightFootData";
                        unityInstance.SendMessage("FootReceiver", methodName, pos);
                    }
                }
            }

            requestAnimationFrame(detectFeetLoop);
        }

        detectFeetLoop();
    }

    window.addEventListener("load", () => {
        if (typeof tf !== "undefined" && typeof bodyPix !== "undefined") {
            startTracking();
        } else {
            console.error("TensorFlow.js or BodyPix not loaded.");
        }
    });
})();
