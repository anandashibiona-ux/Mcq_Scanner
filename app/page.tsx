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
      
      setStatus("CONNECTED. POINT AT A QUESTION.");
      setIsError(false);

      ws.send(JSON.stringify({
        setup: {
          model: "models/gemini-3.8-live", 
          generationConfig: {
            responseModalities: ["TEXT"] 
          },
          systemInstruction: {
            parts: [{ text: "You are a fast, precise MCQ scanner. When asked to evaluate the screen, identify the multiple-choice question, read the options, and state the correct answer with a brief reason." }]
          }
        }
      }));

      // Stream camera frames continuously in the background
      captureInterval = setInterval(() => {
        if (isActive) sendFrame(ws);
      }, 2500);
    };

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
          setResult((prev) => {
            if (prev === "Waiting for the next multiple-choice question to appear." || prev === "") {
              return textParts[0].text;
            }
            return prev + textParts[0].text;
          });
        }
      } catch (e) {
        console.error("Failed to parse Gemini response", e);
      }
    };

    ws.onerror = (error: Event) => {
      if (!isActive) return; 
      setStatus("CONNECTION REJECTED");
      setIsError(true);
    };

    ws.onclose = (event: CloseEvent) => {
      if (!isActive) return; 
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

  // FIXED: Uses realtimeInput text channel to prevent protocol disconnection
  const triggerScan = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setResult(""); 
      setStatus("ANALYZING QUESTION...");
      
      wsRef.current.send(JSON.stringify({
        realtimeInput: {
          text: "Look at the screen right now. Read the question and options, and state the correct answer."
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
        
        <button 
          onClick={triggerScan}
          className="mb-6 px-8 py-3 bg-white text-black font-bold tracking-wide rounded-full hover:bg-gray-200 active:scale-95 transition-all"
        >
          SCAN NOW
        </button>

        <p className="text-gray-300 text-sm text-center max-w-md px-4 overflow-y-auto max-h-24">
          {result}
        </p>
      </div>
    </main>
  );
}
