import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { t } from '@/lib/feedbackTranslations';
import { Language } from '@/lib/translations';
import { AlertTriangle, Lightbulb, Send } from 'lucide-react';

const feedbackAreas = [
  'operations',
  'scheduling',
  'equipment',
  'pay',
  'safety',
  'customer_experience',
  'communication',
  'other'
] as const;

const formSchema = z.object({
  feedbackType: z.string().min(1, 'Please describe what you would like to share'),
  feedbackAreas: z.array(z.enum(feedbackAreas)).min(1, 'Please select at least one area'),
  otherExplanation: z.string().optional(),
  situationExplanation: z.string().min(1, 'Please explain the situation or idea'),
  improvementSuggestion: z.string().optional(),
  isRecurring: z.enum(['yes', 'no', 'not_sure']),
  priority: z.enum(['needs_attention_soon', 'general_improvement']),
  additionalNotes: z.string().optional()
});

type FormValues = z.infer<typeof formSchema>;

interface MoverFeedbackFormProps {
  userId: string;
  language: Language;
  onSuccess?: () => void;
}

export function MoverFeedbackForm({ userId, language, onSuccess }: MoverFeedbackFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moverName, setMoverName] = useState('');
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      feedbackType: '',
      feedbackAreas: [],
      otherExplanation: '',
      situationExplanation: '',
      improvementSuggestion: '',
      isRecurring: 'not_sure',
      priority: 'general_improvement',
      additionalNotes: ''
    }
  });

  const watchedAreas = form.watch('feedbackAreas');
  const showOtherExplanation = watchedAreas.includes('other');

  useEffect(() => {
    const fetchMoverName = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', userId)
        .single();
      
      if (data) {
        setMoverName(`${data.first_name} ${data.last_name}`);
      }
    };
    fetchMoverName();
  }, [userId]);

  const onSubmit = async (values: FormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('mover_feedback')
        .insert({
          mover_id: userId,
          mover_name: moverName,
          feedback_type: values.feedbackType,
          feedback_areas: values.feedbackAreas,
          other_area_explanation: values.otherExplanation || null,
          situation_explanation: values.situationExplanation,
          improvement_suggestion: values.improvementSuggestion || null,
          is_recurring: values.isRecurring,
          priority: values.priority,
          additional_notes: values.additionalNotes || null
        });

      if (error) throw error;

      toast({
        title: t('successTitle', language),
        description: t('successMessage', language)
      });

      form.reset();
      onSuccess?.();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: t('errorTitle', language),
        description: t('errorMessage', language),
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-primary" />
          {t('formTitle', language)}
        </CardTitle>
        <CardDescription className="text-sm">
          {t('formDescription', language)}
        </CardDescription>
        <div className="mt-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 p-4 rounded-lg border-2 border-amber-400 dark:border-amber-500 shadow-md">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {t('importantNotice', language)}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Feedback Type */}
            <FormField
              control={form.control}
              name="feedbackType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('feedbackType', language)}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('feedbackTypePlaceholder', language)}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Feedback Areas */}
            <FormField
              control={form.control}
              name="feedbackAreas"
              render={() => (
                <FormItem>
                  <FormLabel>{t('feedbackArea', language)}</FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {feedbackAreas.map((area) => (
                      <FormField
                        key={area}
                        control={form.control}
                        name="feedbackAreas"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(area)}
                                onCheckedChange={(checked) => {
                                  const updatedAreas = checked
                                    ? [...field.value, area]
                                    : field.value?.filter((value) => value !== area);
                                  field.onChange(updatedAreas);
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal cursor-pointer">
                              {t(area, language)}
                            </FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Other Explanation */}
            {showOtherExplanation && (
              <FormField
                control={form.control}
                name="otherExplanation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('otherExplanation', language)}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Situation Explanation */}
            <FormField
              control={form.control}
              name="situationExplanation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('situationExplanation', language)}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('situationPlaceholder', language)}
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Improvement Suggestion */}
            <FormField
              control={form.control}
              name="improvementSuggestion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('improvementSuggestion', language)}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('improvementPlaceholder', language)}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Is Recurring */}
            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{t('isRecurring', language)}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="yes" />
                        </FormControl>
                        <FormLabel className="font-normal">{t('yes', language)}</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="no" />
                        </FormControl>
                        <FormLabel className="font-normal">{t('no', language)}</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="not_sure" />
                        </FormControl>
                        <FormLabel className="font-normal">{t('notSure', language)}</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>{t('priority', language)}</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="needs_attention_soon" />
                        </FormControl>
                        <FormLabel className="font-normal">{t('needsAttentionSoon', language)}</FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="general_improvement" />
                        </FormControl>
                        <FormLabel className="font-normal">{t('generalImprovement', language)}</FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Additional Notes */}
            <FormField
              control={form.control}
              name="additionalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('additionalNotes', language)}</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={t('additionalNotesPlaceholder', language)}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isSubmitting} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              {isSubmitting ? t('submitting', language) : t('submit', language)}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
