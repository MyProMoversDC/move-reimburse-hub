import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { logEmail } from "../_shared/emailLogger.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get today's month and day
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    // Find users whose birth_date matches today's month and day
    const { data: birthdayUsers, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, avatar_url, birth_date")
      .not("birth_date", "is", null);

    if (error) throw error;

    const todayBirthdays = (birthdayUsers || []).filter((user) => {
      if (!user.birth_date) return false;
      const bd = new Date(user.birth_date + "T00:00:00");
      return bd.getMonth() + 1 === month && bd.getDate() === day;
    });

    if (todayBirthdays.length === 0) {
      return new Response(JSON.stringify({ message: "No birthdays today" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get admin user for creating posts
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1);

    const adminUserId = adminRoles?.[0]?.user_id;
    if (!adminUserId) {
      return new Response(JSON.stringify({ error: "No admin found" }), { status: 500 });
    }

    for (const user of todayBirthdays) {
      const fullName = `${user.first_name} ${user.last_name}`;

      // Check if a birthday post was already created today for this user
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data: existingPosts } = await supabase
        .from("feed_posts")
        .select("id")
        .gte("created_at", todayStart)
        .lt("created_at", todayEnd)
        .ilike("content", `%birthday%${user.first_name}%`);

      if (existingPosts && existingPosts.length > 0) {
        continue; // Skip if already posted
      }

      // Create birthday feed post
      const postContent = `🎂🎉 Happy Birthday, ${fullName}! 🎉🎂\n\nPlease join us in wishing ${user.first_name} a wonderful birthday! Drop your congratulations in the comments below! 🥳🎈`;

      const { error: postError } = await supabase
        .from("feed_posts")
        .insert({
          content: postContent,
          created_by: adminUserId,
          is_published: true,
        });

      if (postError) {
        console.error(`Error creating birthday post for ${fullName}:`, postError);
      }

      // Send email notification to Daniel
      try {
        const emailHtml = `
          <h2>Birthday Notification</h2>
          <p><strong>${fullName}</strong> has a birthday today!</p>
          <p>Date of Birth: ${user.birth_date}</p>
          <p>Email: ${user.email}</p>
          <p>An automatic birthday post has been created on the Feed.</p>
        `;

        const emailResponse = await fetch(`${GATEWAY_URL}/emails`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${lovableApiKey}`,
            "X-Connection-Api-Key": resendApiKey,
          },
          body: JSON.stringify({
            from: "MyProMovers <notifications@mypromoversreimbursements.com>",
            to: ["Daniel@mypromoversdc.com"],
            subject: `🎂 Birthday Today: ${fullName}`,
            html: emailHtml,
          }),
        });

        const emailResult = await emailResponse.json();

        await emailLogger(supabase, {
          emailType: "birthday_notification",
          fromEmail: "notifications@mypromoversreimbursements.com",
          toEmails: ["Daniel@mypromoversdc.com"],
          subject: `🎂 Birthday Today: ${fullName}`,
          bodyHtml: emailHtml,
          status: emailResponse.ok ? "sent" : "failed",
          resendId: emailResult?.id || null,
          errorMessage: emailResponse.ok ? null : JSON.stringify(emailResult),
          referenceId: user.id,
          referenceType: "birthday",
        });
      } catch (emailError) {
        console.error(`Error sending birthday email for ${fullName}:`, emailError);
      }
    }

    return new Response(
      JSON.stringify({ message: `Processed ${todayBirthdays.length} birthdays` }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in check-birthdays:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
