/**
 * Real Microphone Audio Stream & Speech Recognition helper
 * Supports both Web Audio API real volume meter, Web Speech Recognition with permission requests,
 * and audio blob recording for cloud ASR (MiniMax or other backends).
 */

export interface VoiceRecorderState {
  isSupported: boolean;
  isListening: boolean;
  permissionGranted: boolean;
  errorMessage: string | null;
  volumeLevel: number; // 0.0 ~ 1.0 (real audio volume meter)
}

export class RealAudioCapturer {
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animFrameId: number | null = null;
  private recognition: any = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private isIntentionallyStopped: boolean = false;

  public onVolumeChange?: (vol: number) => void;
  public onTranscriptChange?: (text: string, isFinal: boolean) => void;
  public onError?: (errorMsg: string) => void;
  public onStateChange?: (isRecording: boolean) => void;

  constructor() {}

  public async start(): Promise<boolean> {
    this.isIntentionallyStopped = false;
    this.stop();
    this.isIntentionallyStopped = false;

    // 1. Request real microphone access via navigator.mediaDevices
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.onError?.('当前浏览器环境不支持获取麦克风音频权限。');
      // Do not abort, voice island can still remain open for user to speak or select
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      this.mediaStream = stream;

      // 2. Setup real-time Web Audio Analyser for genuine acoustic volume wave feedback
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          if (ctx.state === 'suspended') {
            await ctx.resume();
          }
          this.audioCtx = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.5;
          source.connect(analyser);
          this.analyser = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateVolume = () => {
            if (!this.analyser || this.isIntentionallyStopped) return;
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(1.0, Math.max(0, avg / 128));
            this.onVolumeChange?.(normalized);
            this.animFrameId = requestAnimationFrame(updateVolume);
          };
          updateVolume();
        }
      } catch (audioCtxErr) {
        console.warn('AudioContext volume meter initialization skipped:', audioCtxErr);
      }

      // 3. Setup real MediaRecorder to record genuine audio chunks
      try {
        const recorder = new MediaRecorder(stream);
        this.recordedChunks = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            this.recordedChunks.push(e.data);
          }
        };
        recorder.start(250);
        this.mediaRecorder = recorder;
      } catch (recErr) {
        console.warn('MediaRecorder not available or failed:', recErr);
      }

      // 4. Setup SpeechRecognition (Browser ASR)
      const SpeechRecognitionClass =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognitionClass) {
        try {
          const recognition = new SpeechRecognitionClass();
          recognition.lang = 'zh-CN';
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.maxAlternatives = 1;

          recognition.onresult = (event: any) => {
            let finalStr = '';
            let interimStr = '';
            for (let i = 0; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalStr += event.results[i][0].transcript;
              } else {
                interimStr += event.results[i][0].transcript;
              }
            }
            const fullText = (finalStr + interimStr).trim();
            if (fullText) {
              this.onTranscriptChange?.(fullText, Boolean(finalStr && !interimStr));
            }
          };

          recognition.onerror = (e: any) => {
            console.warn('SpeechRecognition warning:', e.error);
            // Non-fatal speech events: 'no-speech' is normal when user is thinking,
            // 'network' may happen if cloud ASR connection is unstable
            if (e.error === 'not-allowed') {
              this.onError?.('麦克风权限被拒绝，请在地址栏允许麦克风权限');
            } else if (e.error === 'network') {
              console.warn('Speech recognition network error, keeping mic active.');
            } else if (e.error === 'no-speech') {
              // normal idle, do NOT call onError to avoid closing voice island!
            } else {
              console.warn(`Speech recognition event: ${e.error}`);
            }
          };

          recognition.onend = () => {
            // Keep continuous listening if still active and not intentionally stopped
            if (!this.isIntentionallyStopped && this.mediaStream && this.mediaStream.active) {
              try {
                recognition.start();
              } catch (_) {}
            }
          };

          recognition.start();
          this.recognition = recognition;
        } catch (e) {
          console.warn('Failed to start SpeechRecognition:', e);
        }
      }

      this.onStateChange?.(true);
      return true;
    } catch (micErr: any) {
      console.warn('Microphone permission request failed:', micErr);
      if (micErr.name === 'NotAllowedError' || micErr.name === 'PermissionDeniedError') {
        this.onError?.('请允许浏览器使用麦克风以进行实时语音输入');
      } else if (micErr.name === 'NotFoundError' || micErr.name === 'DevicesNotFoundError') {
        this.onError?.('未检测到可用的麦克风输入设备');
      } else {
        this.onError?.(`麦克风启动异常: ${micErr.message || '未知错误'}`);
      }
      this.onStateChange?.(false);
      return false;
    }
  }

  public getRecordedAudioBlob(): Blob | null {
    if (this.recordedChunks.length === 0) return null;
    return new Blob(this.recordedChunks, { type: 'audio/webm' });
  }

  public stop() {
    this.isIntentionallyStopped = true;

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (_) {}
      this.audioCtx = null;
    }

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.onerror = null;
        this.recognition.stop();
      } catch (_) {}
      this.recognition = null;
    }

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch (_) {}
      this.mediaRecorder = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_) {}
      });
      this.mediaStream = null;
    }

    this.onStateChange?.(false);
  }
}
