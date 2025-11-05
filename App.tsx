import React, { useState, useRef, useEffect, useCallback } from 'react';

// Declare TensorFlow and face-detection modules as they are loaded from CDN
declare const tf: any;
declare const faceDetection: any;

// Use the new, better hat image from the provided URL
const BIRTHDAY_HAT_IMG_SRC = 'https://raw.githubusercontent.com/mrngovancuong-cyber/image-data/refs/heads/main/birthdayhat.png';

interface HatPosition {
  top: number;
  left: number;
  width: number;
  height: number;
  transform: string;
  display: 'block' | 'none';
}

type Status = 'IDLE' | 'INITIALIZING_WEBCAM' | 'LOADING_MODEL' | 'READY' | 'DETECTING' | 'ERROR';

const App: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameId = useRef<number>();
  const detectorRef = useRef<any>(null);

  const [status, setStatus] = useState<Status>('IDLE');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [hatPosition, setHatPosition] = useState<HatPosition>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    transform: 'translate(-50%, -100%)',
    display: 'none',
  });
  
  const statusMessages: { [key in Status]?: string } = {
    INITIALIZING_WEBCAM: 'Đang khởi tạo webcam...',
    LOADING_MODEL: 'Đang tải mô hình nhận diện...',
    READY: 'Sẵn sàng! Nhấn Bắt đầu.',
    ERROR: errorMessage,
  };


  const detectFace = useCallback(async () => {
    if (detectorRef.current && videoRef.current && canvasRef.current && videoRef.current.readyState === 4) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        animationFrameId.current = requestAnimationFrame(detectFace);
        return;
      }
      
      try {
        const faces = await detectorRef.current.estimateFaces(video, { flipHorizontal: false });
        console.log(`Số khuôn mặt được phát hiện: ${faces.length}`); // Diagnostic log

        ctx.clearRect(0, 0, canvas.width, canvas.height); 

        if (faces.length > 0) {
          const scaleX = video.offsetWidth / video.videoWidth;
          const scaleY = video.offsetHeight / video.videoHeight;
          
          const face = faces[0];
          const { xMin, yMin, width, height } = face.box;

          const scaledXMin = xMin * scaleX;
          const scaledYMin = yMin * scaleY;
          const scaledWidth = width * scaleX;
          const scaledHeight = height * scaleY;
          
          ctx.strokeStyle = '#00BFFF'; 
          ctx.lineWidth = 4;
          ctx.strokeRect(scaledXMin, scaledYMin, scaledWidth, scaledHeight);

          const hatWidth = scaledWidth * 1.5;
          const hatHeight = hatWidth; 
          const centerX = scaledXMin + scaledWidth / 2;

          setHatPosition({
            left: centerX,
            top: scaledYMin,
            width: hatWidth,
            height: hatHeight,
            transform: 'translate(-50%, -90%) rotate(-10deg)',
            display: 'block',
          });
        } else {
          setHatPosition(prev => ({ ...prev, display: 'none' }));
        }
      } catch (error) {
        console.error("Lỗi trong quá trình nhận diện:", error);
        setErrorMessage("Đã xảy ra lỗi trong khi nhận diện khuôn mặt.");
        setStatus('ERROR');
        if (animationFrameId.current) {
            cancelAnimationFrame(animationFrameId.current);
        }
        return; // Stop the loop
      }
    }
    animationFrameId.current = requestAnimationFrame(detectFace);
  }, []);

  useEffect(() => {
    const initialize = async () => {
      // 1. Initialize Webcam
      setStatus('INITIALIZING_WEBCAM');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise((resolve) => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = () => resolve(videoRef.current);
            }
          });
        }
      } catch (err) {
        console.error('Error accessing webcam:', err);
        setErrorMessage('Không thể truy cập webcam. Vui lòng cấp quyền và làm mới trang.');
        setStatus('ERROR');
        return;
      }

      // 2. Load Model
      setStatus('LOADING_MODEL');
      try {
        await tf.setBackend('webgl');
        await tf.ready(); // Wait for backend to be ready
        const model = faceDetection.SupportedModels.MediaPipeFaceDetector;
        const detectorConfig = { runtime: 'tfjs' };
        detectorRef.current = await faceDetection.createDetector(model, detectorConfig);
      } catch (error) {
          console.error("Failed to load model", error);
          setErrorMessage("Không thể tải mô hình nhận diện. Vui lòng thử lại.");
          setStatus('ERROR');
          return;
      }

      // 3. Ready
      setStatus('READY');
    };

    initialize();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, []);


  const handleStart = () => {
    if (status === 'READY' && videoRef.current && canvasRef.current) {
        // Set canvas resolution ONCE before starting the loop
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.offsetWidth;
        canvas.height = video.offsetHeight;

        setStatus('DETECTING');
        detectFace();
    }
  };
  
  const showOverlay = status !== 'DETECTING';

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
          Đội nón sinh nhật AI
        </h1>
        <p className="text-gray-300 mb-6">Di chuyển đầu của bạn và chiếc nón sẽ tự động theo sau!</p>
        
        <div className="relative w-full aspect-video bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border-2 border-purple-500/50">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-fill"
          ></video>
          <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
          <img
            src={BIRTHDAY_HAT_IMG_SRC}
            alt="Birthday Hat"
            className="absolute pointer-events-none z-10"
            style={{
              display: hatPosition.display,
              top: `${hatPosition.top}px`,
              left: `${hatPosition.left}px`,
              width: `${hatPosition.width}px`,
              height: `${hatPosition.height}px`,
              transform: hatPosition.transform,
              transition: 'top 0.1s linear, left 0.1s linear, width 0.1s linear',
            }}
          />
           <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center" style={{ display: showOverlay ? 'flex' : 'none' }}>
            <div className={`text-xl p-4 ${status === 'ERROR' ? 'text-red-400' : ''}`}>
                {statusMessages[status]}
            </div>
           </div>
        </div>

        {status !== 'DETECTING' && (
          <button
            onClick={handleStart}
            disabled={status !== 'READY'}
            className="mt-8 px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-lg rounded-full shadow-lg hover:scale-105 transform transition-transform duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
          >
            {status === 'READY' ? 'Bắt đầu' : (status === 'ERROR' ? 'Lỗi' : 'Đang tải...')}
          </button>
        )}
      </div>
    </div>
  );
};

export default App;