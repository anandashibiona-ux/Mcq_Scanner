"use client";

import { useCamera } from "./useCamera";
import { useLiveAPI } from "./useLiveAPI";

export default function Home() {
  const { videoRef, isCameraActive } = useCamera();
  const { answer, explanation, status } = useLiveAPI(videoRef);

  return (
    <main className="flex flex-col h-screen bg-black font-sans">
      {/* Top Half: Camera Viewfinder */}
      <div className="flex-1 relative flex items-center justify-center bg-gray-900 overflow-hidden">
        {!isCameraActive && (
          <p className="text-gray-400 z-10 text-sm tracking-wide absolute">
            Requesting camera access...
          </p>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-500 ${isCameraActive ? "opacity-100" : "opacity-0"}`}
        />
      </div>

      {/* Bottom Half: Answer HUD */}
      <div className="h-64 bg-black border-t-2 border-gray-800 p-6 flex flex-col justify-center items-center z-20">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold mb-3 tracking-wider uppercase ${status === "Monitoring Screen" ? "bg-blue-950 text-blue-400" : "bg-red-950 text-red-400"}`}>
          {status}
        </div>

        <h1 className="text-6xl font-black text-white mb-4 text-center">
          {answer}
        </h1>

        <p className="text-gray-400 text-sm text-center max-w-sm leading-relaxed">
          {explanation}
        </p>
      </div>
    </main>
  );
}