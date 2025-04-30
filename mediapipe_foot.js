document.addEventListener("DOMContentLoaded", function () {
    const video = document.createElement("video");
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");
    video.style.display = "none";
    document.body.appendChild(video);

    navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        video.srcObject = stream;
    });

    // Load camera_utils.js first
    const cameraScript = document.createElement("script");
    cameraScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js";
    cameraScript.onload = () => {
        console.log("camera_utils loaded");

        // Then load pose.min.js
        const poseScript = document.createElement("script");
        poseScript.src = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4/pose.min.js";
        poseScript.onload = () => {
            console.log("pose.min.js loaded");

            setTimeout(() => {
                if (typeof window.Pose === "undefined" || typeof window.Camera === "undefined") {
                    console.error("Pose or Camera module not loaded properly.");
                    return;
                }

                const pose = new window.Pose({
                    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.4/${file}`,
                });

                pose.setOptions({
                    modelComplexity: 1,
                    smoothLandmarks: true,
                    enableSegmentation: false,
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5,
                });

                pose.onResults((results) => {
                    if (results.poseLandmarks) {
                        const rightFoot = results.poseLandmarks[32];
                        const x = rightFoot.x * window.innerWidth;
                        const y = rightFoot.y * window.innerHeight;

                        if (typeof unityInstance !== "undefined") {
                            unityInstance.SendMessage("FootReceiver", "ReceiveFootPosition", `${x},${y}`);
                        }
                    }
                });

                const camera = new window.Camera(video, {
                    onFrame: async () => {
                        await pose.send({ image: video });
                    },
                    width: 640,
                    height: 480,
                });
                camera.start();
            }, 100);
        };

        document.body.appendChild(poseScript);
    };

    document.body.appendChild(cameraScript);
});
