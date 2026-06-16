import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { t } from '@/lib/feedbackTranslations';
import { Language } from '@/lib/translations';
import { format } from 'date-fns';
import { Clock, CheckCircle, MessageCircle, AlertCircle } from 'lucide-react';

interface FeedbackResponse {
  id: string;
  response_message: string;
  created_at: string;
}

interface Feedback {
  id: string;
  feedback_type: string;
  feedback_areas: string[];
  other_area_explanation: string | null;
  situation_explanation: string;
  improvement_suggestion: string | null;
  is_recurring: string;
  priority: string;
  additional_notes: string | null;
  status: string;
  created_at: string;
  responses?: FeedbackResponse[];
}

interface MoverFeedbackHistoryProps {
  userId: string;
  language: Language;
  refreshKey?: number;
  anonymousOnly?: boolean;
}

export function MoverFeedbackHistory({ userId, language, refreshKey, anonymousOnly = false }: MoverFeedbackHistoryProps) {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFeedback = async () => {
      setIsLoading(true);
      try {
        let query = supabase
          .from('mover_feedback')
          .select('*')
          .eq('mover_id', userId)
          .order('created_at', { ascending: false });

        // Filter by anonymous flag
        query = query.eq('is_anonymous' as any, anonymousOnly);

        const { data: feedbacks, error: feedbackError } = await query;

        if (feedbackError) throw feedbackError;

        // Fetch responses for each feedback
        const feedbacksWithResponses = await Promise.all(
          (feedbacks || []).map(async (feedback) => {
            const { data: responses } = await supabase
              .from('mover_feedback_responses')
              .select('*')
              .eq('feedback_id', feedback.id)
              .order('created_at', { ascending: true });

            return {
              ...feedback,
              responses: responses || []
            };
          })
        );

        setFeedbackList(feedbacksWithResponses);
      } catch (error) {
        console.error('Error fetching feedback:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFeedback();
  }, [userId, refreshKey, anonymousOnly]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {t('pending', language)}
          </Badge>
        );
      case 'reviewed':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <CheckCircle className="h-3 w-3" />
            {t('reviewed', language)}
          </Badge>
        );
      case 'responded':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
            <MessageCircle className="h-3 w-3" />
            {t('responded', language)}
          </Badge>
        );
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    if (priority === 'needs_attention_soon') {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          {t('needsAttentionSoon', language)}
        </Badge>
      );
    }
    return (
      <Badge variant="outline">
        {t('generalImprovement', language)}
      </Badge>
    );
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  if (feedbackList.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t('noFeedback', language)}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('historyTitle', language)}</h3>
      <Accordion type="single" collapsible className="space-y-2">
        {feedbackList.map((feedback) => (
          <AccordionItem key={feedback.id} value={feedback.id} className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-left w-full pr-4">
                <div className="flex-1">
                  <p className="font-medium line-clamp-1">{feedback.feedback_type}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('submittedOn', language)}: {format(new Date(feedback.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {getStatusBadge(feedback.status)}
                  {getPriorityBadge(feedback.priority)}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('areas', language)}:</p>
                <div className="flex gap-1 flex-wrap mt-1">
                  {feedback.feedback_areas.map((area) => (
                    <Badge key={area} variant="secondary" className="text-xs">
                      {t(area, language)}
                    </Badge>
                  ))}
                </div>
                {feedback.other_area_explanation && (
                  <p className="text-sm mt-1 italic">{feedback.other_area_explanation}</p>
                )}
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('situation', language)}:</p>
                <p className="text-sm mt-1">{feedback.situation_explanation}</p>
              </div>

              {feedback.improvement_suggestion && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('suggestion', language)}:</p>
                  <p className="text-sm mt-1">{feedback.improvement_suggestion}</p>
                </div>
              )}

              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('recurring', language)}:</p>
                <p className="text-sm mt-1">
                  {feedback.is_recurring === 'yes' ? t('yes', language) : 
                   feedback.is_recurring === 'no' ? t('no', language) : t('notSure', language)}
                </p>
              </div>

              {feedback.additional_notes && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{t('additionalNotes', language)}:</p>
                  <p className="text-sm mt-1">{feedback.additional_notes}</p>
                </div>
              )}

              {/* Admin Responses */}
              {feedback.responses && feedback.responses.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">
                    {t('adminResponse', language)}:
                  </p>
                  {feedback.responses.map((response) => (
                    <div key={response.id} className="bg-green-50 dark:bg-green-950 p-3 rounded-md mb-2">
                      <p className="text-sm">{response.response_message}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(response.created_at), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
