import { useState, useEffect, useRef, useCallback } from 'react';

// SpeechRecognition type declarations for browsers that support Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message?: string;
}

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => ISpeechRecognition;

// Helper to normalize dictated warehouse speech into clean SKU format
export function normalizeWarehouseDictation(rawText: string): string {
  if (!rawText) return '';

  let cleaned = rawText.trim();

  // Spoken word replacements commonly heard in warehouse radio/voice input
  const wordMap: Record<string, string> = {
    'dash': '-',
    'hyphen': '-',
    'minus': '-',
    'space': ' ',
    'underscore': '_',
    'dot': '.',
    'point': '.',
    'slash': '/',
    'zero': '0',
    'one': '1',
    'to': '2',
    'too': '2',
    'two': '2',
    'three': '3',
    'four': '4',
    'for': '4',
    'five': '5',
    'six': '6',
    'seven': '7',
    'eight': '8',
    'ate': '8',
    'nine': '9',
    'oh': '0'
  };

  // Replace whole words that match punctuation or digits
  const tokens = cleaned.split(/\s+/);
  const replacedTokens = tokens.map((token) => {
    const lower = token.toLowerCase();
    return wordMap[lower] !== undefined ? wordMap[lower] : token;
  });

  cleaned = replacedTokens.join(' ');

  // Clean up punctuation spacing: e.g. "SKU - 5090" -> "SKU-5090"
  cleaned = cleaned.replace(/\s*-\s*/g, '-');
  cleaned = cleaned.replace(/\s*\.\s*/g, '.');

  // If user says e.g. "SKU 5090" or "SKU RTX"
  // Keep uppercase standard formatting for warehouse SKUs
  return cleaned.toUpperCase();
}

export interface UseWarehouseVoiceSearchOptions {
  onTranscript?: (transcript: string, isFinal: boolean) => void;
  onFinalResult?: (finalText: string) => void;
  language?: string;
  continuous?: boolean;
}

export function useWarehouseVoiceSearch({
  onTranscript,
  onFinalResult,
  language = 'en-US',
  continuous = false
}: UseWarehouseVoiceSearchOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const isManuallyStoppedRef = useRef(false);

  // Check Web Speech API browser availability
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const windowWithSpeech = window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };

      const SpeechRecognition =
        windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

      setIsSupported(Boolean(SpeechRecognition));
    }
  }, []);

  const stopListening = useCallback(() => {
    isManuallyStoppedRef.current = true;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Recognition might already have stopped
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  const startListening = useCallback(() => {
    setErrorMessage(null);
    isManuallyStoppedRef.current = false;

    if (typeof window === 'undefined') return;

    const windowWithSpeech = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition || windowWithSpeech.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage('Web Speech API is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      // Abort previous instance if any
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = continuous;
      recognition.interimResults = true;
      recognition.lang = language;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const transcriptText = result[0].transcript;

          if (result.isFinal) {
            final += transcriptText;
          } else {
            interim += transcriptText;
          }
        }

        if (interim) {
          const formattedInterim = normalizeWarehouseDictation(interim);
          setInterimTranscript(formattedInterim);
          onTranscript?.(formattedInterim, false);
        }

        if (final) {
          const formattedFinal = normalizeWarehouseDictation(final);
          setFinalTranscript(formattedFinal);
          setInterimTranscript('');
          onTranscript?.(formattedFinal, true);
          onFinalResult?.(formattedFinal);
        }
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.warn('Speech recognition event:', event.error);
        if (event.error === 'no-speech') {
          setErrorMessage('No voice detected. Please speak closer to microphone.');
        } else if (event.error === 'audio-capture') {
          setErrorMessage('No microphone detected or microphone is disabled.');
        } else if (event.error === 'not-allowed') {
          setErrorMessage('Microphone access blocked. Please allow microphone permissions in browser.');
        } else if (event.error !== 'aborted') {
          setErrorMessage(`Speech recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setErrorMessage('Could not initialize microphone. Please check browser permissions.');
      setIsListening(false);
    }
  }, [language, continuous, onTranscript, onFinalResult]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isListening,
    isSupported,
    interimTranscript,
    finalTranscript,
    errorMessage,
    startListening,
    stopListening,
    toggleListening,
    clearError: () => setErrorMessage(null)
  };
}
