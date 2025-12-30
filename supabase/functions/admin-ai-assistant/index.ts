import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
    if (!PERPLEXITY_API_KEY) {
      throw new Error('PERPLEXITY_API_KEY is not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    const isAdmin = roles?.some(r => r.role === 'admin');
    if (!isAdmin) {
      throw new Error('Only admins can access the AI assistant');
    }

    const { message, includeContext } = await req.json();

    // Fetch relevant data for context if requested
    let contextData = '';
    if (includeContext) {
      // Fetch summary statistics
      const [
        { data: reimbursements },
        { data: reviewBonuses },
        { data: missingPayments },
        { data: violenceIncidents },
        { data: feedback },
        { data: profiles },
        { data: deductibles }
      ] = await Promise.all([
        supabaseClient.from('reimbursements').select('id, status, total_expenses, mover_full_name, created_at'),
        supabaseClient.from('review_bonuses').select('id, status, mover_id, foreman_name, job_date, created_at'),
        supabaseClient.from('missing_payments').select('id, status, mover_full_name, missing_amount, created_at'),
        supabaseClient.from('violence_incidents').select('id, severity_level, mover_name, incident_date, created_at'),
        supabaseClient.from('mover_feedback').select('id, status, priority, feedback_areas, mover_name, created_at'),
        supabaseClient.from('profiles').select('id, first_name, last_name, email, created_at'),
        supabaseClient.from('deductibles').select('id, amount, mover_name, reason, created_at')
      ]);

      // Build context summary
      const pendingReimbursements = reimbursements?.filter(r => r.status === 'pending') || [];
      const pendingReviews = reviewBonuses?.filter(r => r.status === 'pending') || [];
      const pendingMissingPayments = missingPayments?.filter(r => r.status === 'pending') || [];
      const criticalIncidents = violenceIncidents?.filter(i => i.severity_level === 'critical' || i.severity_level === 'high') || [];
      const pendingFeedback = feedback?.filter(f => f.status === 'pending') || [];

      contextData = `
## Current Portal Data Summary (as of ${new Date().toISOString()}):

### Users
- Total registered users: ${profiles?.length || 0}

### Reimbursements
- Total: ${reimbursements?.length || 0}
- Pending: ${pendingReimbursements.length}
- Total pending amount: $${pendingReimbursements.reduce((sum, r) => sum + Number(r.total_expenses), 0).toFixed(2)}
${pendingReimbursements.length > 0 ? `- Recent pending: ${pendingReimbursements.slice(0, 3).map(r => `${r.mover_full_name} - $${r.total_expenses}`).join(', ')}` : ''}

### Customer Review Bonuses
- Total submissions: ${reviewBonuses?.length || 0}
- Pending review: ${pendingReviews.length}
${pendingReviews.length > 0 ? `- Recent pending: ${pendingReviews.slice(0, 3).map(r => `${r.foreman_name} - ${r.job_date}`).join(', ')}` : ''}

### Missing Payment Claims
- Total: ${missingPayments?.length || 0}
- Pending: ${pendingMissingPayments.length}
${pendingMissingPayments.length > 0 ? `- Recent pending: ${pendingMissingPayments.slice(0, 3).map(r => `${r.mover_full_name} - ${r.missing_amount}`).join(', ')}` : ''}

### Violence/Safety Incidents
- Total reported: ${violenceIncidents?.length || 0}
- Critical/High severity: ${criticalIncidents.length}
${criticalIncidents.length > 0 ? `- Recent critical: ${criticalIncidents.slice(0, 3).map(i => `${i.mover_name} - ${i.incident_date} (${i.severity_level})`).join(', ')}` : ''}

### Mover Feedback
- Total submissions: ${feedback?.length || 0}
- Pending review: ${pendingFeedback.length}
${pendingFeedback.length > 0 ? `- Areas mentioned: ${[...new Set(pendingFeedback.flatMap(f => f.feedback_areas))].join(', ')}` : ''}

### Deductibles
- Total deductibles applied: ${deductibles?.length || 0}
- Total deducted amount: $${deductibles?.reduce((sum, d) => sum + Number(d.amount), 0).toFixed(2) || '0.00'}
`;
    }

    const systemPrompt = `You are an AI assistant for a moving company's employee portal administration. You help admins analyze employee data, identify trends, and make informed decisions.

Your capabilities:
- Analyze reimbursement patterns and identify anomalies
- Review customer review bonus submissions trends
- Identify patterns in missing payment claims
- Assess violence/safety incident severity and patterns
- Analyze mover feedback for common themes
- Provide actionable insights for workforce management

Always be professional, concise, and data-driven in your responses. When discussing specific employees or sensitive matters, maintain appropriate discretion.

${contextData}`;

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: 1024,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || 'No response generated';
    const citations = data.citations || [];

    console.log('AI Assistant response generated successfully');

    return new Response(JSON.stringify({ 
      response: aiResponse,
      citations 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Admin AI Assistant error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
