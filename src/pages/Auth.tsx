import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { z } from "zod";
import { translations } from "@/lib/translations";
import { handleError } from "@/lib/errorHandler";
import { Languages, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const { language, setLanguage } = useLanguage();
  const isSigningUpRef = useRef(false);
  
  const t = translations[language];

  // Signup form
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [useNicknameInChat, setUseNicknameInChat] = useState(false);

  // Login form
  const [identifier, setIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Forgot password form
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !isSigningUpRef.current) {
        navigate("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && !isSigningUpRef.current) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const signupSchemaWithMessages = z.object({
        selectedRole: z.string().min(1, t.roleRequired),
        firstName: z.string().trim().min(1, t.firstNameRequired).max(100),
        lastName: z.string().trim().min(1, t.lastNameRequired).max(100),
        dateOfBirth: z.string().min(1, t.dobRequired),
        email: z.string().trim().email(t.invalidEmail).max(255),
        username: z.string().trim().min(3, t.usernameMinLength).max(50),
        phone: z.string().trim().min(10, t.phoneMinLength).max(20),
        password: z.string().min(6, t.passwordMinLength),
      });
      
      const validated = signupSchemaWithMessages.parse({
        selectedRole, firstName, lastName, dateOfBirth, email, username, phone, password
      });

      setLoading(true);
      isSigningUpRef.current = true;
      
      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: {
            username: validated.username,
            first_name: validated.firstName,
            last_name: validated.lastName,
            phone: validated.phone,
            birth_date: validated.dateOfBirth,
            nickname: nickname.trim() || null,
            use_nickname_in_chat: useNicknameInChat,
            selected_role: validated.selectedRole,
          },
        },
      });

      if (error) throw error;

      // Sign out immediately - account is pending approval
      await supabase.auth.signOut();
      
      // Send notification to admins
      try {
        await supabase.functions.invoke("send-signup-notification", {
          body: {
            firstName: validated.firstName,
            lastName: validated.lastName,
            email: validated.email,
            phone: validated.phone,
            selectedRole: validated.selectedRole,
            dateOfBirth: validated.dateOfBirth,
            nickname: nickname.trim() || null,
          },
        });
      } catch (notifError) {
        console.error("Failed to send signup notification:", notifError);
      }
      
      toast.success(t.accountCreated);
      setIsSignup(false);
      
      // Clear form
      setSelectedRole("");
      setFirstName("");
      setLastName("");
      setDateOfBirth("");
      setEmail("");
      setUsername("");
      setPhone("");
      setPassword("");
      setNickname("");
      setUseNicknameInChat(false);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
      isSigningUpRef.current = false;
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const loginSchemaWithMessages = z.object({
        identifier: z.string().trim().min(1, t.identifierRequired),
        password: z.string().min(1, t.passwordRequired),
      });
      
      const validated = loginSchemaWithMessages.parse({ identifier, password: loginPassword });

      setLoading(true);
      
      const isEmail = validated.identifier.includes("@");
      let loginEmail = validated.identifier;

      if (!isEmail) {
        const { data, error: rpcError } = await supabase
          .rpc("get_email_by_username", { input_username: validated.identifier });

        if (rpcError || !data) {
          throw new Error(t.invalidCredentials);
        }
        loginEmail = data;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: validated.password,
      });

      if (error) throw error;

      // Check signup_status
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("signup_status")
          .eq("id", session.user.id)
          .single();

        if (profile && (profile as any).signup_status === "pending") {
          await supabase.auth.signOut();
          toast.error(t.accountPendingApproval);
          return;
        }
        if (profile && (profile as any).signup_status === "declined") {
          await supabase.auth.signOut();
          toast.error(t.accountDeclined);
          return;
        }
      }
      
      toast.success(t.loggedInSuccess);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const resetEmailSchema = z.object({
        email: z.string().trim().email(t.invalidEmail),
      });
      
      const validated = resetEmailSchema.parse({ email: resetEmail });

      setLoading(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) throw error;
      
      toast.success(t.resetLinkSent);
      setResetEmail("");
      setShowForgotPassword(false);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <div className="absolute top-4 right-4">
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-[160px] bg-background">
            <Languages className="h-4 w-4 mr-2" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-background border border-border z-50">
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="ru">Русский</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="MyProMovers" className="h-16 mx-auto mb-4" />
          <CardTitle className="text-2xl">{t.reimbursementPortal}</CardTitle>
          <CardDescription>{t.signInToManage}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={isSignup ? "signup" : "login"} onValueChange={(v) => setIsSignup(v === "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signup">{t.signUp}</TabsTrigger>
              <TabsTrigger value="login">{t.login}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                {/* Role Selection */}
                <div className="space-y-2">
                  <Label>{t.selectRole}</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder={t.selectRole} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mover">{t.mover}</SelectItem>
                      <SelectItem value="office_staff">{t.officeStaff}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Disclaimer */}
                <div className="bg-warning/10 border border-warning/30 rounded-md p-3 text-sm text-warning-foreground flex gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <span>{t.nameDisclaimer}</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">{t.firstName}</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">{t.lastName}</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">{t.dateOfBirth}</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="username">{t.username}</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="phone">{t.phoneNumber}</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">{t.password}</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                {/* Nickname */}
                <div className="space-y-2">
                  <Label htmlFor="nickname">{t.nickname}</Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={t.nicknamePlaceholder}
                  />
                </div>

                {/* Use nickname in chat checkbox */}
                {nickname.trim() && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="useNicknameInChat"
                      checked={useNicknameInChat}
                      onCheckedChange={(checked) => setUseNicknameInChat(checked === true)}
                    />
                    <Label htmlFor="useNicknameInChat" className="text-sm font-normal cursor-pointer">
                      {t.useNicknameInChat}
                    </Label>
                  </div>
                )}
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t.creatingAccount : t.signUpButton}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="login">
              {showForgotPassword ? (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="resetEmail">{t.email}</Label>
                    <Input
                      id="resetEmail"
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder={t.resetEmailPlaceholder}
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t.sendingResetLink : t.sendResetLink}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    {t.backToLogin}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="identifier">{t.emailOrUsername}</Label>
                    <Input
                      id="identifier"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="loginPassword">{t.password}</Label>
                    <Input
                      id="loginPassword"
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      required
                    />
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? t.loggingIn : t.loginButton}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="link"
                    className="w-full text-sm"
                    onClick={() => setShowForgotPassword(true)}
                  >
                    {t.forgotPassword}
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
