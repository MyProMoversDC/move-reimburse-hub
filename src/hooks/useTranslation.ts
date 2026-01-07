import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface UseTranslationResult {
  translateTexts: (texts: string[]) => Promise<string[]>;
  isTranslating: boolean;
}

export function useTranslation(): UseTranslationResult {
  const [isTranslating, setIsTranslating] = useState(false);

  const translateTexts = async (texts: string[]): Promise<string[]> => {
    if (texts.length === 0) return texts;
    
    // Check if any text might need translation (contains non-ASCII characters)
    const hasNonEnglish = texts.some(text => 
      text && /[^\x00-\x7F]/.test(text)
    );
    
    if (!hasNonEnglish) {
      return texts;
    }

    setIsTranslating(true);
    try {
      const { data, error } = await supabase.functions.invoke('translate-text', {
        body: { texts }
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
