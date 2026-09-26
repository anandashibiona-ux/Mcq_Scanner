"use client";
import { useEffect, useRef, useState } from "react";

export default function Scanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [status, setStatus] = useState<string>("CONNECTING TO AI...");
  const [result, setResult] = useState<string>("Waiting for the next multiple-choice question to appear.");
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    let isActive = true;

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      setStatus("ERROR: API KEY IS MISSING");
      setIsError(true);
      return;
    }

    let captureInterval: ReturnType<typeof setInterval>;

    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => console.error("Camera access denied:", err));

    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!isActive) return;

      console.log("WebSocket Connection Opened Successfully");
      setStatus("CONNECTED. MONITORING SCREEN.");
      setIsError(false);

      ws.send(JSON.stringify({
        setup: {
          model: "models/gemini-3.8-live",
          generationConfig: {
            responseModalities: ["TEXT"]
          },
          systemInstruction: {
            parts: [{ text: "You are an MCQ scanner. Read the multiple-choice question from the video feed and state only the correct answer and a brief reason." }]
          }
        }
      }));

      captureInterval = setInterval(() => {
        if (isActive) sendFrame(ws);
      }, 2500);
    };

    // CRITICAL FIX: Convert binary Blob to text before parsing
    ws.onmessage = async (event: MessageEvent) => {
      if (!isActive) return;
      try {
        let responseText = event.data;

        if (event.data instanceof Blob) {
          responseText = await event.data.text();
        }

        const data = JSON.parse(responseText);
        const textParts = data?.serverContent?.modelTurn?.parts;
        if (textParts && textParts.length > 0) {
          setResult(textParts[0].text);
        }
      } catch (e) {
        console.error("Failed to parse Gemini response", e);
      }
    };

    ws.onerror = (error: Event) => {
      if (!isActive) return;

      console.error("WebSocket Connection Error:", error);
      setStatus("CONNECTION REJECTED");
      setIsError(true);
    };

    ws.onclose = (event: CloseEvent) => {
      if (!isActive) return;

      console.log(`WebSocket Connection Closed. Code: ${event.code}, Reason: ${event.reason}`);
      setStatus("DISCONNECTED. REFRESH TO RECONNECT.");
      setIsError(true);
    };

    return () => {
      isActive = false;
      if (captureInterval) clearInterval(captureInterval);
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, []);

  const sendFrame = (ws: WebSocket) => {
    if (!videoRef.current || !canvasRef.current || ws.readyState !== WebSocket.OPEN) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;

    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const base64Data = canvas.toDataURL("image/jpeg", 0.5);
    const base64Image = base64Data.split(",")[1];

    if (base64Image) {
      ws.send(JSON.stringify({
        realtimeInput: {
          mediaChunks: [{
            mimeType: "image/jpeg",
            data: base64Image
          }]
        }
      }));
    }
  };

  return (
    <main className="min-h-screen flex flex-col bg-black font-sans">
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex-1 relative flex items-center justify-center bg-gray-900 overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      </div>

      <div className="h-64 bg-black border-t-2 border-gray-800 p-6 flex flex-col justify-center items-center z-20">
        <div className={`px-4 py-2 rounded-full text-xs font-bold tracking-wider mb-6 ${isError ? 'bg-red-950 text-red-500' : 'bg-blue-950 text-blue-400'}`}>
          {status}
        </div>
        <div className="flex gap-1 mb-8">
          <div className="w-6 h-3 bg-white rounded-sm"></div>
          <div className="w-6 h-3 bg-white rounded-sm"></div>
        </div>
        <p className="text-gray-400 text-sm text-center max-w-md px-4">
          {result}
        </p>
      </div>
    </main>
  );
}
