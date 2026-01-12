import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useMapboxToken() {
  const [token, setToken] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchToken = async () => {
      try {
        // Call a simple edge function to get the token
        const { data, error } = await supabase.functions.invoke("get-mapbox-token");
        
        if (error) {
          console.error("Error fetching Mapbox token:", error);
          return;
        }
        
        if (data?.token) {
          setToken(data.token);
        }
      } catch (error) {
        console.error("Error fetching Mapbox token:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, []);

  return { token, loading };
}
