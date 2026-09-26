import { useState, useEffect, useRef } from "react";

export function useCamera() {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);

    useEffect(() => {
        async function startCamera() {
            try {
                // This asks the user for permission and gets the video stream[cite: 1]
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment" }
                });

                // Connect the live stream to our video element[cite: 1]
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setIsCameraActive(true);
                }
            } catch (err) {
                console.error("Camera access denied or unavailable.", err);
            }
        }

        startCamera();

        // Cleanup: Turn off the camera if the component unmounts
        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                const stream = videoRef.current.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return { videoRef, isCameraActive };
}