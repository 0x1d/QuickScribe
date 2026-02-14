# ⚡ QuickScribe

> World-class real-time transcription and translation powered by Gemini Live.

QuickScribe is a high-performance, low-latency transcription tool designed to capture and translate conversations in real-time. Built with a specialized focus on **Swiss German dialects**, it bridges the gap between spoken local vernacular and formal written language.

## ✨ Key Features

- **🔴 Live Transcription**: Experience zero-latency audio processing using the `gemini-2.5-flash-native-audio-preview` model.
- **🇨🇭 Swiss German Mastery**: Specifically tuned to understand various Swiss German dialects and translate them into Standard German or English instantly.
- **📂 Persistent Sessions**: Your conversations are automatically saved to local storage, allowing you to resume or reference them anytime.
- **💾 Data Portability**: Export your full transcripts as structured JSON files with a single click.
- **📱 Responsive & Elegant**: A minimalist, mobile-first design built with Tailwind CSS, featuring smooth auto-scrolling and real-time "Processing" feedback.
- **🔐 Privacy First**: Audio is streamed directly to the Gemini API and processed in real-time without permanent server-side storage of raw audio files.

## 🚀 Getting Started

1. **Select a Language**: Choose your input dialect (e.g., Swiss German) and target output.
2. **Hit Record**: Grant microphone permissions and start speaking.
3. **Watch it Scribe**: Segments are finalized into complete sentences as you speak.
4. **Manage History**: Rename sessions or delete old ones via the intuitive sidebar.

## 🛠️ Technology Stack

- **React 19**: Modern component architecture.
- **Google Gemini Live API**: Real-time multimodal (audio-to-text) interaction.
- **Tailwind CSS**: Utility-first styling for a premium aesthetic.
- **Web Audio API**: High-fidelity PCM audio capture at 16kHz.

---

*Developed by a Senior Frontend Engineer with a focus on cutting-edge AI integration.*