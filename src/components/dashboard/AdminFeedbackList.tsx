import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Clock, CheckCircle, MessageCircle, AlertCircle, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { TranslateButton } from './TranslateButton';

interface FeedbackResponse {
  id: string;
  response_message: string;
  created_at: string;
}

interface Feedback {
  id: string;
  mover_id: string;
  mover_name: string;
  is_anonymous?: boolean;
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
  reviewed_at: string | null;
  responses?: FeedbackResponse[];
  mover_email?: string;
}

interface AdminFeedbackListProps {
  refreshKey?: number;
}

const areaLabels: Record<string, string> = {
  operations: 'Operations / How jobs are run',
  scheduling: 'Scheduling or dispatch',
  equipment: 'Equipment or trucks',
  pay: 'Pay or compensation structure',
  safety: 'Safety',
  customer_experience: 'Customer experience',
  communication: 'Communication',
  other: 'Other'
};

export function AdminFeedbackList({ refreshKey }: AdminFeedbackListProps) {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [filteredFeedback, setFilteredFeedback] = useState<Feedback[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed' | 'responded'>('all');
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showResponseDialog, setShowResponseDialog] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [translatedCards, setTranslatedCards] = useState<Map<string, {
    situation_explanation: string;
    improvement_suggestion: string;
    additional_notes: string;
    other_area_explanation: string;
  }>>(new Map());
  const [translatingCardId, setTranslatingCardId] = useState<string | null>(null);
  
  const { toast } = useToast();
  const { translateTexts, isTranslating } = useTranslation();

  useEffect(() => {
    fetchFeedback();
  }, [refreshKey]);

  useEffect(() => {
    if (filter === 'all') {
      setFilteredFeedback(feedbackList);
    } else {
      setFilteredFeedback(feedbackList.filter(f => f.status === filter));
    }
  }, [filter, feedbackList]);

  const fetchFeedback = async () => {
    setIsLoading(true);
    try {
      const { data: feedbacks, error: feedbackError } = await supabase
        .from('mover_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      if (feedbackError) throw feedbackError;

      // Fetch mover emails and responses for each feedback
      const feedbacksWithDetails = await Promise.all(
        (feedbacks || []).map(async (feedback: any) => {
          const isAnon = !!feedback.is_anonymous;
          const [profileResult, responsesResult] = await Promise.all([
            isAnon
              ? Promise.resolve({ data: null })
              : supabase
                  .from('profiles')
                  .select('email')
                  .eq('id', feedback.mover_id)
                  .single(),
            supabase
              .from('mover_feedback_responses')
              .select('*')
              .eq('feedback_id', feedback.id)
              .order('created_at', { ascending: true })
          ]);

          return {
            ...feedback,
            mover_name: isAnon ? 'Anonymous' : feedback.mover_name,
            mover_email: isAnon ? undefined : (profileResult as any).data?.email,
            responses: responsesResult.data || []
          };
        })
      );

      setFeedbackList(feedbacksWithDetails);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTranslateFeedback = async (feedback: Feedback) => {
    if (translatedCards.has(feedback.id)) {
      // Toggle off translation
      const newMap = new Map(translatedCards);
      newMap.delete(feedback.id);
      setTranslatedCards(newMap);
      return;
    }
    
    setTranslatingCardId(feedback.id);
    const translations = await translateTexts([
      feedback.situation_explanation,
      feedback.improvement_suggestion || "",
      feedback.additional_notes || "",
      feedback.other_area_explanation || "",
    ]);
    
    setTranslatedCards(new Map(translatedCards).set(feedback.id, {
      situation_explanation: translations[0],
      improvement_suggestion: translations[1],
      additional_notes: translations[2],
      other_area_explanation: translations[3],
    }));
    setTranslatingCardId(null);
  };

  const toggleExpanded = (id: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleMarkAsReviewed = async (feedback: Feedback) => {
    try {
      const { error } = await supabase
        .from('mover_feedback')
        .update({ status: 'reviewed', reviewed_at: new Date().toISOString() })
        .eq('id', feedback.id);

      if (error) throw error;

      toast({ title: 'Feedback marked as reviewed' });
      fetchFeedback();
    } catch (error) {
      console.error('Error updating feedback:', error);
      toast({ title: 'Error', description: 'Failed to update feedback', variant: 'destructive' });
    }
  };

  const handleSendResponse = async () => {
    if (!selectedFeedback || !responseMessage.trim()) return;

    setIsSending(true);
    try {
      // Call edge function to send email and save response
      const { error: fnError } = await supabase.functions.invoke('send-feedback-response', {
        body: {
          feedbackId: selectedFeedback.id,
          moverId: selectedFeedback.mover_id,
          moverEmail: selectedFeedback.mover_email,
          moverName: selectedFeedback.mover_name,
          responseMessage: responseMessage.trim(),
          feedbackType: selectedFeedback.feedback_type
        }
      });

      if (fnError) throw fnError;

      toast({ title: 'Response sent successfully' });
      setShowResponseDialog(false);
      setResponseMessage('');
      setSelectedFeedback(null);
      fetchFeedback();
    } catch (error) {
      console.error('Error sending response:', error);
      toast({ title: 'Error', description: 'Failed to send response', variant: 'destructive' });
    } finally {
      setIsSending(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Pending
          </Badge>
        );
      case 'reviewed':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
            <CheckCircle className="h-3 w-3" />
            Reviewed
          </Badge>
        );
      case 'responded':
        return (
          <Badge variant="outline" className="flex items-center gap-1 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300">
            <MessageCircle className="h-3 w-3" />
            Responded
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
          Urgent
        </Badge>
      );
    }
    return <Badge variant="outline">General</Badge>;
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold">Mover Feedback Review</h2>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">All ({feedbackList.length})</TabsTrigger>
            <TabsTrigger value="pending">Pending ({feedbackList.filter(f => f.status === 'pending').length})</TabsTrigger>
            <TabsTrigger value="reviewed">Reviewed ({feedbackList.filter(f => f.status === 'reviewed').length})</TabsTrigger>
            <TabsTrigger value="responded">Responded ({feedbackList.filter(f => f.status === 'responded').length})</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {filteredFeedback.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No feedback submissions to review.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredFeedback.map((feedback) => (
            <Card key={feedback.id} className={feedback.priority === 'needs_attention_soon' ? 'border-destructive' : ''}>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="flex-1">
                    <CardTitle className="text-base font-medium">{feedback.mover_name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(feedback.created_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {getStatusBadge(feedback.status)}
                    {getPriorityBadge(feedback.priority)}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Feedback Type:</p>
                  <p className="text-sm">{feedback.feedback_type}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-muted-foreground">Areas:</p>
                  <div className="flex gap-1 flex-wrap mt-1">
                    {feedback.feedback_areas.map((area) => (
                      <Badge key={area} variant="secondary" className="text-xs">
                        {areaLabels[area] || area}
                      </Badge>
                    ))}
                  </div>
                </div>

                {expandedCards.has(feedback.id) && (
                  <>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Situation/Idea:</p>
                      <p className="text-sm">
                        {translatedCards.has(feedback.id) 
                          ? translatedCards.get(feedback.id)?.situation_explanation 
                          : feedback.situation_explanation}
                      </p>
                    </div>

                    {feedback.improvement_suggestion && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Improvement Suggestion:</p>
                        <p className="text-sm">
                          {translatedCards.has(feedback.id) 
                            ? translatedCards.get(feedback.id)?.improvement_suggestion 
                            : feedback.improvement_suggestion}
                        </p>
                      </div>
                    )}

                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Recurring Issue:</p>
                      <p className="text-sm capitalize">{feedback.is_recurring.replace('_', ' ')}</p>
                    </div>

                    {feedback.additional_notes && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Additional Notes:</p>
                        <p className="text-sm">
                          {translatedCards.has(feedback.id) 
                            ? translatedCards.get(feedback.id)?.additional_notes 
                            : feedback.additional_notes}
                        </p>
                      </div>
                    )}

                    {feedback.responses && feedback.responses.length > 0 && (
                      <div className="pt-3 border-t">
                        <p className="text-sm font-medium text-green-700 dark:text-green-300 mb-2">Previous Responses:</p>
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
                  </>
                )}

                <div className="flex flex-wrap gap-2 pt-2">
                  <TranslateButton
                    onClick={() => handleTranslateFeedback(feedback)}
                    isTranslating={isTranslating && translatingCardId === feedback.id}
                    isTranslated={translatedCards.has(feedback.id)}
                  />
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(feedback.id)}
                  >
                    {expandedCards.has(feedback.id) ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-1" />
                        Show Less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-1" />
                        Show More
                      </>
                    )}
                  </Button>

                  {feedback.status === 'pending' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkAsReviewed(feedback)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark as Reviewed
                    </Button>
                  )}

                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      setSelectedFeedback(feedback);
                      setShowResponseDialog(true);
                    }}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Respond
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Response Dialog */}
      <Dialog open={showResponseDialog} onOpenChange={setShowResponseDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Respond to Feedback</DialogTitle>
          </DialogHeader>
          {selectedFeedback && (
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm font-medium">From: {selectedFeedback.mover_name}</p>
                <p className="text-sm text-muted-foreground mt-1">{selectedFeedback.feedback_type}</p>
              </div>
              <Textarea
                placeholder="Enter your response to the mover..."
                value={responseMessage}
                onChange={(e) => setResponseMessage(e.target.value)}
                className="min-h-[150px]"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResponseDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendResponse} disabled={isSending || !responseMessage.trim()}>
              {isSending ? 'Sending...' : 'Send Response'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
