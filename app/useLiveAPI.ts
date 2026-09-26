import { useState, useEffect, useRef, RefObject } from "react";


export function useLiveAPI(videoRef: React.RefObject<HTMLVideoElement | null>) {
    const [answer, setAnswer] = useState("--");
    const [explanation, setExplanation] = useState("Waiting for the next multiple-choice question to appear.");
    const [status, setStatus] = useState("Connecting to AI...");

    useEffect(() => {
        const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            setStatus("Error: Missing API Key in .env.local");
            return;
        }

        // 1. Open the continuous connection to the Gemini Live API[cite: 1]
        const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`);

        ws.onopen = () => {
            setStatus("Monitoring Screen");

            // 2. Send the initial setup configuration and system prompt[cite: 1]
            ws.send(JSON.stringify({
                setup: {
                    model: "models/gemini-2.0-flash-exp",
                    systemInstruction: {
                        parts: [{
                            text: "You are a passive observer watching a screen. Whenever a new multiple-choice question appears, instantly read it, solve it, and output the correct option. Format your output strictly as: 'Option [Letter] - [Brief explanation]'. Do not speak or output anything until the question changes."
                        }]
                    }
                }
            }));
        };

        // 3. Listen for the AI's text responses[cite: 1]
        ws.onmessage = (event) => {
            const response = JSON.parse(event.data);
            if (response.serverContent?.modelTurn) {
                const text = response.serverContent.modelTurn.parts[0].text;
                if (text) {
                    // Splits the AI's format: "Option C - The formula requires a negative value."
                    const parts = text.split("-");
                    if (parts.length >= 2) {
                        setAnswer(parts[0].trim());
                        setExplanation(parts.slice(1).join("-").trim());
                    }
                }
            }
        };

        ws.onclose = () => setStatus("Disconnected. Refresh to reconnect.");

        // 4. Frame capture loop: take a lightweight snapshot every 2 seconds[cite: 5]
        const interval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN && videoRef.current) {
                const canvas = document.createElement("canvas");

                // Downscale the image to save bandwidth and prevent phone overheating
                canvas.width = 640;
                canvas.height = 480;
                const ctx = canvas.getContext("2d");

                if (ctx) {
                    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
                    const base64Image = canvas.toDataURL("image/jpeg", 0.7).split(",")[1];

                    ws.send(JSON.stringify({
                        realtimeInput: {
                            mediaChunks: [{
                                mimeType: "image/jpeg",
                                data: base64Image
                            }]
                        }
                    }));
                }
            }
        }, 2000);

        return () => {
            clearInterval(interval);
            ws.close();
        };
    }, [videoRef]);

    return { answer, explanation, status };
}