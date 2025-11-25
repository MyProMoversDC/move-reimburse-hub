import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { z } from "zod";
import { translations, Language } from "@/lib/translations";
import { Languages } from "lucide-react";

const signupSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  email: z.string().trim().email("Invalid email address").max(255),
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(50),
  phone: z.string().trim().min(10, "Phone number must be at least 10 digits").max(20),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignup, setIsSignup] = useState(true);
  const [language, setLanguage] = useState<Language>('en');
  
  const t = translations[language];

  // Signup form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Login form
  const [identifier, setIdentifier] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        navigate("/dashboard");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const signupSchemaWithMessages = z.object({
        firstName: z.string().trim().min(1, t.firstNameRequired).max(100),
        lastName: z.string().trim().min(1, t.lastNameRequired).max(100),
        email: z.string().trim().email(t.invalidEmail).max(255),
        username: z.string().trim().min(3, t.usernameMinLength).max(50),
        phone: z.string().trim().min(10, t.phoneMinLength).max(20),
        password: z.string().min(6, t.passwordMinLength),
      });
      
      const validated = signupSchemaWithMessages.parse({
        firstName, lastName, email, username, phone, password
      });

      setLoading(true);
      
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
          },
        },
      });

      if (error) throw error;
      
      toast.success(t.accountCreated);
      setIsSignup(false);
      
      // Clear form
      setFirstName("");
      setLastName("");
      setEmail("");
      setUsername("");
      setPhone("");
      setPassword("");
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
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

      // If username provided, fetch email using secure function
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
      
      toast.success(t.loggedInSuccess);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <div className="absolute top-4 right-4">
        <Select value={language} onValueChange={(value) => setLanguage(value as Language)}>
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
                
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t.creatingAccount : t.signUpButton}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="login">
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
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
