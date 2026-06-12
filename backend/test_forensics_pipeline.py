import os
import cv2
import numpy as np
import scipy.io.wavfile as wavfile
import scipy.signal
import sys

# Ensure backend/app directory is in path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.services.synthetic_analysis_service import synthetic_media_analyzer

def generate_mock_video(filepath: str, is_ai: bool = False):
    """Generates a mock MP4 video file.
    
    If is_ai=True, it introduces:
    - Periodic high-frequency checkerboard noise (FFT anomaly)
    - Boundary morphing (wobbling circles)
    - Geometric warping (Hu moment instability)
    """
    print(f"Generating {'AI' if is_ai else 'Natural'} mock video at: {filepath}")
    
    # 24 frames, 512x512
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(filepath, fourcc, 10.0, (512, 512))
    
    for t in range(24):
        # Base frame (dark background)
        frame = np.zeros((512, 512, 3), dtype=np.uint8)
        
        # Draw a central shape (e.g. circle representing an object)
        center_x = 256
        center_y = 256
        
        if is_ai:
            # 1. Boundary morphing: radius changes/wobbles dynamically over time
            radius = int(80 + 30 * np.sin(t * 0.8))
            # 2. Geometric warping: shape morphs from circle to rounded rectangle
            thickness = -1
            if t % 2 == 0:
                cv2.circle(frame, (center_x, center_y), radius, (200, 200, 200), thickness)
            else:
                cv2.rectangle(frame, (center_x - radius, center_y - radius), 
                              (center_x + radius, center_y + radius), (200, 200, 200), thickness)
        else:
            # Natural: shape moves linearly (translational motion, stable geometry)
            radius = 80
            offset = int(t * 3)
            cv2.circle(frame, (center_x + offset, center_y), radius, (200, 200, 200), -1)
            
        # Draw some "text" represented by a high-contrast rectangle
        if is_ai:
            # AI text boxes resize and jitter randomly
            w_text = int(120 + 25 * np.random.randn())
            h_text = int(40 + 10 * np.random.randn())
            cv2.rectangle(frame, (50, 50), (50 + w_text, 50 + h_text), (255, 255, 255), -1)
        else:
            # Natural: text is static
            cv2.rectangle(frame, (50, 50), (170, 90), (255, 255, 255), -1)

        # 3. FFT Checkerboard Up-sampling anomalies
        if is_ai:
            # Inject a high-frequency grid pattern (checkerboard)
            x_grid, y_grid = np.meshgrid(np.arange(512), np.arange(512))
            # 8px periodic pattern
            grid_pattern = (np.sin(x_grid * (2 * np.pi / 8.0)) * np.sin(y_grid * (2 * np.pi / 8.0)) > 0)
            noise = (grid_pattern * 25).astype(np.uint8)
            frame = cv2.add(frame, cv2.merge([noise, noise, noise]))
        else:
            # Natural: add standard Gaussian sensor grain (white noise)
            noise = np.random.normal(0, 5, frame.shape).astype(np.uint8)
            frame = cv2.add(frame, noise)
            
        writer.write(frame)
        
    writer.release()
    print("Video generation complete.")

def generate_mock_audio(filepath: str, is_ai: bool = False):
    """Generates a mock WAV audio track.
    
    If is_ai=True, it introduces:
    - Highly phase-coupled tones (bicoherence anomaly)
    - Perfect digital silence in gaps (lack of breath)
    """
    print(f"Generating {'AI' if is_ai else 'Natural'} mock audio at: {filepath}")
    
    sr = 16000
    duration = 4.0  # 4 seconds
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    
    # Base frequencies
    f1 = 150.0  # Pitch harmonic
    f2 = 300.0
    
    if is_ai:
        # Phase-coupled signal: x(t) = sin(2*pi*f1*t + phi1) + sin(2*pi*f2*t + phi2) + sin(2*pi*(f1+f2)*t + (phi1+phi2))
        # Deterministic phase relationship triggers high bicoherence
        phi1 = np.pi / 4.0
        phi2 = np.pi / 3.0
        phi3 = phi1 + phi2
        
        signal = (np.sin(2 * np.pi * f1 * t + phi1) + 
                  np.sin(2 * np.pi * f2 * t + phi2) + 
                  np.sin(2 * np.pi * (f1 + f2) * t + phi3))
        
        # Perfect digital silence gap (TTS artifact)
        silence_start = int(sr * 1.5)
        silence_end = int(sr * 2.5)
        signal[silence_start:silence_end] = 0.0
        
    else:
        # Natural signal: phase is randomized across frequencies (organic phase shifts)
        # Also includes breath noise (Gaussian noise) in gaps
        signal = np.sin(2 * np.pi * f1 * t + np.random.rand() * 2 * np.pi)
        signal += np.sin(2 * np.pi * f2 * t + np.random.rand() * 2 * np.pi)
        signal += np.sin(2 * np.pi * (f1 + f2) * t + np.random.rand() * 2 * np.pi)
        
        # Speech envelope gap with breathing noise (low amplitude flat noise)
        gap_start = int(sr * 1.5)
        gap_end = int(sr * 2.5)
        breath = np.random.normal(0, 0.05, gap_end - gap_start)
        # Apply low-pass filter to breath
        b, a = scipy.signal.butter(4, 0.2)
        breath = scipy.signal.lfilter(b, a, breath)
        signal[gap_start:gap_end] = breath
        
    # Normalize and scale to 16-bit PCM
    signal = signal / np.max(np.abs(signal))
    signal_scaled = (signal * 32767).astype(np.int16)
    
    wavfile.write(filepath, sr, signal_scaled)
    print("Audio generation complete.")

def main():
    video_natural = "test_natural.mp4"
    video_ai = "test_ai.mp4"
    audio_natural = "test_natural.wav"
    audio_ai = "test_ai.wav"
    
    # 1. Generate media samples
    generate_mock_video(video_natural, is_ai=False)
    generate_mock_video(video_ai, is_ai=True)
    generate_mock_audio(audio_natural, is_ai=False)
    generate_mock_audio(audio_ai, is_ai=True)
    
    print("\n" + "="*60)
    print("RUNNING FORENSIC PIPELINE ON NATURAL MEDIA")
    print("="*60)
    
    vis_res_natural = synthetic_media_analyzer.analyze_deepfake_video(video_natural)
    aud_res_natural = synthetic_media_analyzer.analyze_audio(audio_natural)
    
    print("VISUAL ANALYSIS DETAILS:")
    for k, v in vis_res_natural.items():
        if k != "details":
            print(f"  {k}: {v}")
    print("  RAW VISUAL METRICS:")
    for k, v in vis_res_natural["details"].items():
        print(f"    {k}: {v}")
        
    print("\nAUDIO ANALYSIS DETAILS:")
    for k, v in aud_res_natural.items():
        if k != "details":
            print(f"  {k}: {v}")
    print("  RAW AUDIO METRICS:")
    for k, v in aud_res_natural["details"].items():
        print(f"    {k}: {v}")
        
    # Combine scores
    scores_natural = {
        "fft_artifacts": vis_res_natural["details"]["fft_artifacts_probability"],
        "optical_flow": vis_res_natural["details"]["optical_flow_probability"],
        "geometric_invariance": vis_res_natural["details"]["geometric_invariance_probability"],
        "bicoherence": aud_res_natural["details"]["bicoherence_probability"],
        "phase_mapping": aud_res_natural["details"]["phase_mapping_probability"],
        "micro_pauses": aud_res_natural["details"]["micro_pauses_probability"],
    }
    combined_natural = synthetic_media_analyzer.combine_forensic_scores(scores_natural)
    print(f"--> Combined AI / Stock Ratio (Natural): {combined_natural * 100:.2f}%")
    
    print("\n" + "="*60)
    print("RUNNING FORENSIC PIPELINE ON GENERATIVE AI MEDIA")
    print("="*60)
    
    vis_res_ai = synthetic_media_analyzer.analyze_deepfake_video(video_ai)
    aud_res_ai = synthetic_media_analyzer.analyze_audio(audio_ai)
    
    print("VISUAL ANALYSIS DETAILS:")
    for k, v in vis_res_ai.items():
        if k != "details":
            print(f"  {k}: {v}")
    print("  RAW VISUAL METRICS:")
    for k, v in vis_res_ai["details"].items():
        print(f"    {k}: {v}")
        
    print("\nAUDIO ANALYSIS DETAILS:")
    for k, v in aud_res_ai.items():
        if k != "details":
            print(f"  {k}: {v}")
    print("  RAW AUDIO METRICS:")
    for k, v in aud_res_ai["details"].items():
        print(f"    {k}: {v}")
        
    scores_ai = {
        "fft_artifacts": vis_res_ai["details"]["fft_artifacts_probability"],
        "optical_flow": vis_res_ai["details"]["optical_flow_probability"],
        "geometric_invariance": vis_res_ai["details"]["geometric_invariance_probability"],
        "bicoherence": aud_res_ai["details"]["bicoherence_probability"],
        "phase_mapping": aud_res_ai["details"]["phase_mapping_probability"],
        "micro_pauses": aud_res_ai["details"]["micro_pauses_probability"],
    }
    combined_ai = synthetic_media_analyzer.combine_forensic_scores(scores_ai)
    print(f"--> Combined AI / Stock Ratio (AI): {combined_ai * 100:.2f}%")
    
    # Clean up files
    for f in [video_natural, video_ai, audio_natural, audio_ai]:
        try:
            os.remove(f)
        except OSError:
            pass

if __name__ == '__main__':
    main()
