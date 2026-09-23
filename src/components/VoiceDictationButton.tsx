import React from 'react';
import { Mic, MicOff, AlertCircle, Sparkles } from 'lucide-react';
import { useWarehouseVoiceSearch } from '../hooks/useWarehouseVoiceSearch';

interface VoiceDictationButtonProps {
  id?: string;
  onTranscript: (text: string) => void;
  className?: string;
  size?: 'sm' | 'md';
  title?: string;
}

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  id = 'warehouse-sku-voice-btn',
  onTranscript,
  className = '',
  size = 'sm',
  title = 'Dictate SKU with voice (Web Speech API)'
}) => {
  const {
    isListening,
    isSupported,
    interimTranscript,
    errorMessage,
    toggleListening,
    clearError
  } = useWarehouseVoiceSearch({
    onTranscript: (transcript) => {
      onTranscript(transcript);
    },
    onFinalResult: (finalText) => {
      onTranscript(finalText);
    }
  });

  return (
    <div className="relative inline-flex items-center">
      <button
        id={id}
        type="button"
        onClick={toggleListening}
        title={
          !isSupported
            ? 'Web Speech API is not supported in this browser'
            : isListening
            ? 'Listening... Click to stop dictation'
            : title
        }
        className={`relative flex items-center justify-center rounded-lg transition-all cursor-pointer ${
          size === 'sm' ? 'w-7 h-7 p-1' : 'w-8 h-8 p-1.5'
        } ${
          isListening
            ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 ring-2 ring-rose-400 ring-offset-1 ring-offset-neutral-950 animate-pulse'
            : isSupported
            ? 'bg-neutral-800 hover:bg-neutral-700 text-sky-400 hover:text-sky-300 border border-neutral-700/80 active:scale-95'
            : 'bg-neutral-900 text-neutral-600 border border-neutral-800 cursor-not-allowed opacity-60'
        } ${className}`}
      >
        {isListening ? (
          <Mic className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} animate-bounce`} />
        ) : (
          <Mic className={`${size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
        )}

        {/* Pulse ring when listening */}
        {isListening && (
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
        )}
      </button>

      {/* Floating active voice tooltip or error */}
      {isListening && (
        <div className="absolute right-0 top-full mt-1.5 z-50 whitespace-nowrap px-2.5 py-1 rounded-lg bg-neutral-900 border border-rose-500/40 text-[10px] font-mono text-rose-300 shadow-xl flex items-center gap-1.5 pointer-events-none">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
          <span>{interimTranscript ? `"${interimTranscript}"` : 'Listening for SKU (e.g. "SKU 5090")...'}</span>
        </div>
      )}

      {errorMessage && (
        <div
          onClick={clearError}
          className="absolute right-0 top-full mt-1.5 z-50 whitespace-nowrap px-2 py-1 rounded-lg bg-rose-950/90 border border-rose-500/50 text-[10px] text-rose-200 shadow-xl flex items-center gap-1 cursor-pointer"
        >
          <AlertCircle className="w-3 h-3 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
          <span className="text-[9px] underline ml-1 text-neutral-400">(dismiss)</span>
        </div>
      )}
    </div>
  );
};
