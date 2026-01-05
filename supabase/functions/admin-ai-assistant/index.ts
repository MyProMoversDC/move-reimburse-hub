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
      // Fetch ALL data with complete details for comprehensive answers
      const [
        { data: reimbursements },
        { data: reviewBonuses },
        { data: missingPayments },
        { data: violenceIncidents },
        { data: feedback },
        { data: profiles },
        { data: deductibles },
        { data: performanceReports },
        { data: balances },
        { data: transactions }
      ] = await Promise.all([
        supabaseClient.from('reimbursements').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('review_bonuses').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('missing_payments').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('violence_incidents').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('mover_feedback').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('profiles').select('*'),
        supabaseClient.from('deductibles').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('performance_reports').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('mover_balances').select('*'),
        supabaseClient.from('mover_bonus_transactions').select('*').order('created_at', { ascending: false })
      ]);

      // Build context summary with FULL data
      const pendingReimbursements = reimbursements?.filter(r => r.status === 'pending') || [];
      const confirmedReimbursements = reimbursements?.filter(r => r.status === 'confirmed') || [];
      const paidReimbursements = reimbursements?.filter(r => r.status === 'paid') || [];
      const declinedReimbursements = reimbursements?.filter(r => r.status === 'declined') || [];
      const appealReimbursements = reimbursements?.filter(r => r.status === 'appeal') || [];

      const pendingReviews = reviewBonuses?.filter(r => r.status === 'pending') || [];
      const confirmedReviews = reviewBonuses?.filter(r => r.status === 'confirmed') || [];
      const declinedReviews = reviewBonuses?.filter(r => r.status === 'declined') || [];
      const appealReviews = reviewBonuses?.filter(r => r.status === 'appeal') || [];

      const pendingMissingPayments = missingPayments?.filter(r => r.status === 'pending') || [];
      const confirmedMissingPayments = missingPayments?.filter(r => r.status === 'confirmed') || [];
      const declinedMissingPayments = missingPayments?.filter(r => r.status === 'declined') || [];

      const criticalIncidents = violenceIncidents?.filter(i => i.severity_level === 'critical') || [];
      const highIncidents = violenceIncidents?.filter(i => i.severity_level === 'high') || [];

      const pendingFeedback = feedback?.filter(f => f.status === 'pending') || [];

      // Group data by mover for detailed per-mover statistics
      const moverStats: Record<string, any> = {};
      
      // Process profiles first
      profiles?.forEach(p => {
        const fullName = `${p.first_name} ${p.last_name}`.trim();
        moverStats[p.id] = {
          name: fullName,
          email: p.email,
          phone: p.phone,
          reimbursements: { total: 0, pending: 0, confirmed: 0, paid: 0, declined: 0, appeal: 0, totalAmount: 0 },
          reviewBonuses: { total: 0, pending: 0, confirmed: 0, declined: 0, appeal: 0 },
          missingPayments: { total: 0, pending: 0, confirmed: 0, declined: 0 },
          violenceIncidents: { total: 0, critical: 0, high: 0 },
          feedback: { total: 0, pending: 0 },
          deductibles: { total: 0, totalAmount: 0 },
          performanceReports: { total: 0 },
          balance: 0
        };
      });

      // Process reimbursements per mover
      reimbursements?.forEach(r => {
        if (moverStats[r.mover_id]) {
          moverStats[r.mover_id].reimbursements.total++;
          moverStats[r.mover_id].reimbursements[r.status]++;
          moverStats[r.mover_id].reimbursements.totalAmount += Number(r.total_expenses);
        }
      });

      // Process review bonuses per mover
      reviewBonuses?.forEach(r => {
        if (moverStats[r.mover_id]) {
          moverStats[r.mover_id].reviewBonuses.total++;
          moverStats[r.mover_id].reviewBonuses[r.status]++;
        }
      });

      // Process missing payments per mover
      missingPayments?.forEach(r => {
        if (moverStats[r.mover_id]) {
          moverStats[r.mover_id].missingPayments.total++;
          moverStats[r.mover_id].missingPayments[r.status]++;
        }
      });

      // Process violence incidents per mover
      violenceIncidents?.forEach(i => {
        if (moverStats[i.mover_id]) {
          moverStats[i.mover_id].violenceIncidents.total++;
          if (i.severity_level === 'critical') moverStats[i.mover_id].violenceIncidents.critical++;
          if (i.severity_level === 'high') moverStats[i.mover_id].violenceIncidents.high++;
        }
      });

      // Process feedback per mover
      feedback?.forEach(f => {
        if (moverStats[f.mover_id]) {
          moverStats[f.mover_id].feedback.total++;
          if (f.status === 'pending') moverStats[f.mover_id].feedback.pending++;
        }
      });

      // Process deductibles per mover
      deductibles?.forEach(d => {
        if (moverStats[d.mover_id]) {
          moverStats[d.mover_id].deductibles.total++;
          moverStats[d.mover_id].deductibles.totalAmount += Number(d.amount);
        }
      });

      // Process balances per mover
      balances?.forEach(b => {
        if (moverStats[b.mover_id]) {
          moverStats[b.mover_id].balance = Number(b.balance);
        }
      });

      // Create detailed mover list
      const moverDetailsList = Object.entries(moverStats)
        .filter(([_, stats]: [string, any]) => stats.name)
        .map(([id, stats]: [string, any]) => 
          `- ${stats.name} (${stats.email}): Reimbursements: ${stats.reimbursements.total} (pending: ${stats.reimbursements.pending}, total $${stats.reimbursements.totalAmount.toFixed(2)}), Review Bonuses: ${stats.reviewBonuses.total} (pending: ${stats.reviewBonuses.pending}), Missing Payments: ${stats.missingPayments.total}, Violence Incidents: ${stats.violenceIncidents.total}, Deductibles: ${stats.deductibles.total} ($${stats.deductibles.totalAmount.toFixed(2)}), Balance: $${stats.balance.toFixed(2)}`
        ).join('\n');

      // Create recent submissions list
      const recentReimbursementsList = reimbursements?.slice(0, 20).map(r => 
        `- ${r.mover_full_name}: $${r.total_expenses} (${r.status}) - Job #${r.job_number}, ${r.customer_name} - ${new Date(r.created_at).toLocaleDateString()}`
      ).join('\n') || 'None';

      const recentReviewsList = reviewBonuses?.slice(0, 20).map(r => 
        `- Foreman: ${r.foreman_name}, Client: ${r.client_full_name}, Invoice: ${r.invoice_number} (${r.status}) - ${new Date(r.created_at).toLocaleDateString()}`
      ).join('\n') || 'None';

      const recentMissingPaymentsList = missingPayments?.slice(0, 20).map(r => 
        `- ${r.mover_full_name}: $${r.missing_amount} (${r.status}) - Job #${r.job_number}, ${r.customer_name} - ${new Date(r.created_at).toLocaleDateString()}`
      ).join('\n') || 'None';

      const recentIncidentsList = violenceIncidents?.slice(0, 10).map(i => 
        `- ${i.mover_name}: ${i.severity_level} severity, ${i.incident_types.join(', ')} - ${i.incident_date} at ${i.incident_address}`
      ).join('\n') || 'None';

      const recentPerformanceReportsList = performanceReports?.slice(0, 10).map(r => 
        `- ${r.title}: Worker: ${r.worker_name}, Category: ${r.incident_category}, Severity: ${r.severity_level} - ${new Date(r.incident_datetime).toLocaleDateString()}`
      ).join('\n') || 'None';

      const recentDeductiblesList = deductibles?.slice(0, 10).map(d => 
        `- ${d.mover_name}: $${d.amount} - Reason: ${d.reason || 'No reason provided'} - ${new Date(d.created_at).toLocaleDateString()}`
      ).join('\n') || 'None';

      contextData = `
## Complete Portal Data (as of ${new Date().toISOString()}):

### OVERVIEW STATISTICS

#### Users/Movers
- Total registered users: ${profiles?.length || 0}

#### Reimbursements (Total: ${reimbursements?.length || 0})
- Pending: ${pendingReimbursements.length} (Total: $${pendingReimbursements.reduce((sum, r) => sum + Number(r.total_expenses), 0).toFixed(2)})
- Confirmed: ${confirmedReimbursements.length}
- Paid: ${paidReimbursements.length}
- Declined: ${declinedReimbursements.length}
- On Appeal: ${appealReimbursements.length}
- Grand Total Amount: $${reimbursements?.reduce((sum, r) => sum + Number(r.total_expenses), 0).toFixed(2) || '0.00'}

#### Customer Review Bonuses (Total: ${reviewBonuses?.length || 0})
- Pending: ${pendingReviews.length}
- Confirmed: ${confirmedReviews.length}
- Declined: ${declinedReviews.length}
- On Appeal: ${appealReviews.length}

#### Missing Payment Claims (Total: ${missingPayments?.length || 0})
- Pending: ${pendingMissingPayments.length}
- Confirmed: ${confirmedMissingPayments.length}
- Declined: ${declinedMissingPayments.length}

#### Violence/Safety Incidents (Total: ${violenceIncidents?.length || 0})
- Critical: ${criticalIncidents.length}
- High: ${highIncidents.length}
- Medium: ${violenceIncidents?.filter(i => i.severity_level === 'medium').length || 0}
- Low: ${violenceIncidents?.filter(i => i.severity_level === 'low').length || 0}

#### Performance/Misconduct Reports (Total: ${performanceReports?.length || 0})
- Critical: ${performanceReports?.filter(r => r.severity_level === 'Critical').length || 0}
- High: ${performanceReports?.filter(r => r.severity_level === 'High').length || 0}
- Medium: ${performanceReports?.filter(r => r.severity_level === 'Medium').length || 0}
- Low: ${performanceReports?.filter(r => r.severity_level === 'Low').length || 0}

#### Mover Feedback (Total: ${feedback?.length || 0})
- Pending: ${pendingFeedback.length}
- Common areas: ${[...new Set(feedback?.flatMap(f => f.feedback_areas) || [])].join(', ')}

#### Deductibles (Total: ${deductibles?.length || 0})
- Total Amount Deducted: $${deductibles?.reduce((sum, d) => sum + Number(d.amount), 0).toFixed(2) || '0.00'}

#### Transactions (Total: ${transactions?.length || 0})
- Total Bonuses: $${transactions?.filter(t => t.transaction_type === 'bonus').reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2) || '0.00'}
- Total Deductions: $${transactions?.filter(t => t.transaction_type === 'deductible').reduce((sum, t) => sum + Number(t.amount), 0).toFixed(2) || '0.00'}

---

### PER-MOVER STATISTICS
${moverDetailsList}

---

### RECENT REIMBURSEMENT SUBMISSIONS (Last 20)
${recentReimbursementsList}

---

### RECENT REVIEW BONUS SUBMISSIONS (Last 20)
${recentReviewsList}

---

### RECENT MISSING PAYMENT CLAIMS (Last 20)
${recentMissingPaymentsList}

---

### RECENT VIOLENCE/SAFETY INCIDENTS (Last 10)
${recentIncidentsList}

---

### RECENT PERFORMANCE/MISCONDUCT REPORTS (Last 10)
${recentPerformanceReportsList}

---

### RECENT DEDUCTIBLES (Last 10)
${recentDeductiblesList}
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
