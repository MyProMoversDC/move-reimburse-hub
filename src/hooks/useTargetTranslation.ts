import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseTargetTranslationResult {
  translateTexts: (texts: string[], targetLanguage: 'es' | 'ru') => Promise<string[]>;
  isTranslating: boolean;
}

export function useTargetTranslation(): UseTargetTranslationResult {
  const [isTranslating, setIsTranslating] = useState(false);

  const translateTexts = async (texts: string[], targetLanguage: 'es' | 'ru'): Promise<string[]> => {
    if (texts.length === 0) return texts;
    
    // Check if any text has content
    const hasContent = texts.some(text => text && text.trim());
    if (!hasContent) return texts;

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: { texts, targetLanguage }
      });

      if (error) {
        console.error('Translation error:', error);
        toast.error('Translation failed. Please try again.');
        return texts;
      }

      if (data?.error) {
        toast.error(data.error);
        return texts;
      }

      return data?.translations || texts;
    } catch (error) {
      console.error('Translation error:', error);
      toast.error('Translation service unavailable');
      return texts;
    } finally {
      setIsTranslating(false);
    }
  };

  return { translateTexts, isTranslating };
}
