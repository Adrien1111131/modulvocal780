import axiosInstance from './axiosConfig';
import axios from 'axios';
import { config, logger } from '../config/development';

const VOICE_ID = import.meta.env.VITE_ELEVENLABS_VOICE_ID || '';
const API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || '';
const API_URL = `${config.api.baseUrl}/text-to-speech/${VOICE_ID}`;

// Vérification de la présence des variables d'environnement
if (!VOICE_ID || !API_KEY) {
  logger.error('Variables d\'environnement manquantes: VITE_ELEVENLABS_VOICE_ID ou VITE_ELEVENLABS_API_KEY');
  console.error('Variables d\'environnement manquantes: VITE_ELEVENLABS_VOICE_ID ou VITE_ELEVENLABS_API_KEY');
}

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
}

interface TextSegment {
  text: string;
  emotion: string;
  analysis: TextAnalysis;
}

interface TextAnalysis {
  intensity: number;
  rhythm: number;
  pause: boolean;
  isQuestion: boolean;
  isExclamation: boolean;
  emotionalProgression: number;
}

const emotionKeywords = {
  sensuel: ['désir', 'doux', 'caresse', 'peau', 'frisson', 'sensuel', 'chaleur', 'corps'],
  excite: ['gémis', 'soupir', 'excité', 'passionné', 'brûlant', 'urgent', 'envie', 'trembler'],
  jouissance: ['extase', 'jouir', 'orgasme', 'plaisir', 'délice', 'intense', 'explosion'],
  murmure: ['murmure', 'souffle', 'chuchote', 'doux', 'tendre', 'délicat'],
  intense: ['fort', 'intense', 'profond', 'puissant', 'violent', 'ardent', 'sauvage'],
  doux: ['tendre', 'doux', 'délicat', 'léger', 'suave', 'douceur']
};

const analyzeText = (text: string): TextAnalysis => {
  logger.group('Analyse du texte');
  logger.debug('Texte à analyser:', text);
  
  const lowerText = text.toLowerCase();
  
  const hasPause = text.includes('...');
  const exclamationCount = (text.match(/!/g) || []).length;
  const questionCount = (text.match(/\?/g) || []).length;
  const ellipsisCount = (text.match(/\.\.\./g) || []).length;
  
  let intensityScore = 0;
  
  intensityScore += exclamationCount * 0.15;
  intensityScore += questionCount * 0.1;
  intensityScore += ellipsisCount * 0.05;
  
  logger.debug('Scores de ponctuation:', { exclamationCount, questionCount, ellipsisCount });
  
  Object.entries(emotionKeywords).forEach(([emotion, keywords]) => {
    keywords.forEach(keyword => {
      const matches = lowerText.match(new RegExp(keyword, 'g'));
      if (matches) {
        intensityScore += matches.length * 0.1;
        logger.debug(`Mot-clé trouvé (${emotion}):`, keyword, matches.length);
      }
    });
  });

  const sentences = text.split(/[.!?…]+/).filter(s => s.trim().length > 0);
  const avgSentenceLength = sentences.reduce((sum, s) => sum + s.length, 0) / sentences.length;
  const rhythm = Math.min(1.0, avgSentenceLength / 80);

  const emotionalProgression = sentences.reduce((progression, sentence, index) => {
    const position = index / sentences.length;
    const localIntensity = calculateLocalIntensity(sentence);
    return progression + (localIntensity * position);
  }, 0) / sentences.length;

  const analysis = {
    intensity: Math.min(1.0, intensityScore),
    rhythm,
    pause: hasPause,
    isQuestion: questionCount > 0,
    isExclamation: exclamationCount > 0,
    emotionalProgression
  };

  logger.debug('Résultat de l\'analyse:', analysis);
  logger.groupEnd();
  return analysis;
};

const calculateLocalIntensity = (sentence: string): number => {
  const lowerSentence = sentence.toLowerCase();
  let intensity = 0;

  const intensityWords = ['fort', 'intense', 'passionné', 'urgent', 'violemment', 'profond'];
  intensityWords.forEach(word => {
    if (lowerSentence.includes(word)) intensity += 0.2;
  });

  if (sentence.includes('!')) intensity += 0.3;
  if (sentence.includes('?')) intensity += 0.2;
  if (sentence.includes('...')) intensity += 0.1;

  return Math.min(1.0, intensity);
};

const getVoiceSettings = (emotion: string, analysis: TextAnalysis): VoiceSettings => {
  logger.group('Calcul des paramètres de voix');
  logger.debug('Émotion:', emotion);
  logger.debug('Analyse:', analysis);
  
  const baseSettings: Record<string, VoiceSettings> = {
    sensuel: {
      stability: 0.5,
      similarity_boost: 0.85
    },
    excite: {
      stability: 0.35,
      similarity_boost: 0.95
    },
    jouissance: {
      stability: 0.25,
      similarity_boost: 1.0
    },
    murmure: {
      stability: 0.95,
      similarity_boost: 0.7
    },
    intense: {
      stability: 0.3,
      similarity_boost: 0.9
    },
    doux: {
      stability: 0.8,
      similarity_boost: 0.75
    }
  };

  const settings = baseSettings[emotion] || baseSettings.sensuel;
  const adjustedSettings = {
    ...settings,
    stability: Math.max(0.2, Math.min(0.95, settings.stability * (1 - analysis.intensity * 0.4))),
    similarity_boost: Math.max(0.5, Math.min(1.0, settings.similarity_boost + analysis.emotionalProgression * 0.2))
  };

  logger.debug('Paramètres ajustés:', adjustedSettings);
  logger.groupEnd();
  return adjustedSettings;
};

const addBreathingAndPauses = (text: string, emotion: string): string => {
  logger.group('Ajout des respirations et pauses');
  logger.debug('Texte initial:', text);
  logger.debug('Émotion:', emotion);
  
  const breathIntensity = {
    sensuel: 'soft',
    excite: 'medium',
    jouissance: 'heavy',
    murmure: 'soft',
    intense: 'heavy',
    doux: 'soft'
  }[emotion] || 'medium';

  // Remplacer les points de suspension par des pauses plus naturelles
  text = text.replace(/\.\.\./g, `<break time="800ms"/> <break strength="${breathIntensity}"/> `);

  // Ajouter des pauses après la ponctuation
  text = text.replace(/([.!?])/g, `$1<break time="600ms"/> <break strength="${breathIntensity}"/> `);
  text = text.replace(/,/g, ',<break time="300ms"/> ');

  // Ajouter des respirations aux moments appropriés
  text = text.replace(/(gémis|soupir|souffle)/gi, (match) => `<break strength="${breathIntensity}"/> ${match}`);

  logger.debug('Texte avec respirations:', text);
  logger.groupEnd();
  return text;
};

const parseTextSegments = (text: string): TextSegment[] => {
  logger.group('Parsing des segments');
  logger.debug('Texte à parser:', text);
  
  const segments: TextSegment[] = [];
  const regex = /\[(\w+)\](.*?)\[\/\1\]|([^\[\]]+)/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    logger.debug('Match trouvé:', match);
    if (match[1] && match[2]) {
      const emotion = match[1];
      const content = match[2].trim();
      if (content) {
        const analysis = analyzeText(content);
        segments.push({ text: content, emotion, analysis });
      }
    } else if (match[3]) {
      const content = match[3].trim();
      if (content) {
        const analysis = analyzeText(content);
        segments.push({ text: content, emotion: 'sensuel', analysis });
      }
    }
  }

  logger.debug('Segments générés:', segments);
  logger.groupEnd();
  return segments;
};

export const generateVoice = async (text: string): Promise<string> => {
  try {
    logger.group('Génération de la voix');
    logger.info('Début de la génération pour le texte:', text);
    
    const segments = parseTextSegments(text);
    logger.debug('Segments analysés:', segments);

    const firstSegment = segments[0];
    const settings = getVoiceSettings(firstSegment.emotion, firstSegment.analysis);

    const processedText = segments
      .map(segment => {
        const textWithBreathing = addBreathingAndPauses(segment.text, segment.emotion);
        return `<prosody rate="${
          segment.emotion === 'murmure' ? '80%' : 
          segment.emotion === 'intense' ? '110%' : 
          '100%'
        }" pitch="${
          segment.emotion === 'murmure' ? '-20%' : 
          segment.emotion === 'intense' ? '+20%' : 
          '0%'
        }">${textWithBreathing}</prosody>`;
      })
      .join('<break time="1000ms"/> ');

    const ssmlText = `<speak>${processedText}</speak>`;
    logger.debug('Texte SSML final:', ssmlText);

    logger.info('Envoi de la requête à l\'API');
    const response = await axiosInstance.post(
      API_URL,
      {
        text: ssmlText,
        model_id: "eleven_multilingual_v2",
        voice_settings: settings
      },
      {
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        responseType: 'blob',
        timeout: config.api.timeout
      }
    );

    logger.info('Réponse reçue de l\'API');
    const audioBlob = new Blob([response.data], { type: 'audio/mpeg' });
    const audioUrl = URL.createObjectURL(audioBlob);
    logger.debug('URL audio générée:', audioUrl);
    
    logger.groupEnd();
    return audioUrl;
  } catch (error: unknown) {
    logger.error('Erreur lors de la génération de la voix:', error);
    if (axios.isAxiosError(error)) {
      logger.error('Réponse de l\'API:', error.response?.data);
      logger.error('Status:', error.response?.status);
      logger.error('Headers:', error.response?.headers);
    }
    throw new Error('Échec de la génération de la voix');
  }
};
