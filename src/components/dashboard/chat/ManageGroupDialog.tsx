import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, UserMinus, UserPlus, Image as ImageIcon, FileText, Film, Music, Download, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import { getSignedUrlsBatch } from "@/lib/storageUtils";
import { downloadFilesAsZip } from "@/lib/bulkDownload";

interface User {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url?: string | null;
  roles?: string[];
}

interface Attachment {
  id: string;
  message_id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  created_at: string;
  signed_url?: string;
  thumb_url?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  conversationId: string;
  conversationName: string | null;
  currentUserId: string;
  onMembersChanged: () => void;
}

const ManageGroupDialog = ({ open, onClose, conversationId, conversationName, currentUserId, onMembersChanged }: Props) => {
  const [members, setMembers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [media, setMedia] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (open) loadAll();
  }, [open, conversationId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [{ data: parts }, { data: pickerUsers }, { data: msgs }] = await Promise.all([
        supabase.from("conversation_participants").select("user_id").eq("conversation_id", conversationId),
        supabase.rpc("list_chat_users_for_picker"),
        supabase.from("chat_messages").select("id").eq("conversation_id", conversationId),
      ]);

      const memberIds = (parts || []).map((p: any) => p.user_id);
      const userIds = Array.from(new Set([...memberIds, ...((pickerUsers as any[]) || []).map((u) => u.id)]));

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
      const roleMap = new Map(((pickerUsers as any[]) || []).map((u) => [u.id, u.roles]));

      const memberList: User[] = memberIds.map((id) => {
        const p: any = profileMap.get(id) || {};
        return {
          id,
          first_name: p.first_name || "",
          last_name: p.last_name || "",
          avatar_url: p.avatar_url,
          roles: roleMap.get(id) as any,
        };
      });

      const usersList: User[] = (pickerUsers as any[] || [])
        .filter((u) => !memberIds.includes(u.id))
        .map((u) => {
          const p: any = profileMap.get(u.id) || {};
          return {
            id: u.id,
            first_name: u.first_name,
            last_name: u.last_name,
            avatar_url: p.avatar_url,
            roles: u.roles,
          };
        });

      setMembers(memberList);
      setAllUsers(usersList);

      // Media library
      const messageIds = (msgs || []).map((m: any) => m.id);
      if (messageIds.length > 0) {
        const { data: atts } = await supabase
          .from("chat_message_attachments")
          .select("*")
          .in("message_id", messageIds)
          .order("created_at", { ascending: false });
        if (atts && atts.length > 0) {
          const paths: string[] = [];
          for (const a of atts as any[]) {
            paths.push(a.file_url);
            if (a.file_type?.startsWith("image/")) paths.push(`${a.file_url}.thumb.jpg`);
          }
          const signed = await getSignedUrlsBatch("chat-attachments", paths);
          setMedia(
            (atts as any[]).map((a) => ({
              ...a,
              file_url: signed.get(a.file_url) || a.file_url,
              thumb_url: a.file_type?.startsWith("image/")
                ? signed.get(`${a.file_url}.thumb.jpg`) || undefined
                : undefined,
            }))
          );
        } else {
          setMedia([]);
        }
      } else {
        setMedia([]);
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load group details");
    } finally {
      setLoading(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (userId === currentUserId) {
      toast.error("You cannot remove yourself here");
      return;
    }
    setBusyId(userId);
    const { error } = await supabase
      .from("conversation_participants")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", userId);
    setBusyId(null);
    if (error) {
      toast.error("Failed to remove member");
      return;
    }
    toast.success("Member removed");
    onMembersChanged();
    loadAll();
  };

  const addMember = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase
      .from("conversation_participants")
      .insert({ conversation_id: conversationId, user_id: userId });
    setBusyId(null);
    if (error) {
      toast.error("Failed to add member");
      return;
    }
    toast.success("Member added");
    onMembersChanged();
    loadAll();
  };

  const fileIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon className="h-4 w-4" />;
    if (type.startsWith("video/")) return <Film className="h-4 w-4" />;
    if (type.startsWith("audio/")) return <Music className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const filtered = (list: User[]) =>
    list.filter((u) => `${u.first_name} ${u.last_name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Manage Group: {conversationName || "Group Chat"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="members" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
              <TabsTrigger value="add">Add People</TabsTrigger>
              <TabsTrigger value="media">Media ({media.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search members" className="pl-8" />
              </div>
              <ScrollArea className="h-[400px] border rounded-md p-2">
                {filtered(members).map((m) => (
                  <div key={m.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded-md">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={m.avatar_url || undefined} />
                      <AvatarFallback>{m.first_name?.[0]}{m.last_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{m.first_name} {m.last_name}</p>
                      {m.roles && m.roles.length > 0 && (
                        <p className="text-xs text-muted-foreground">{m.roles.join(", ")}</p>
                      )}
                    </div>
                    {m.id !== currentUserId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeMember(m.id)}
                        disabled={busyId === m.id}
                      >
                        {busyId === m.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4 text-destructive" />}
                      </Button>
                    )}
                    {m.id === currentUserId && <Badge variant="secondary">You</Badge>}
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="add" className="space-y-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users" className="pl-8" />
              </div>
              <ScrollArea className="h-[400px] border rounded-md p-2">
                {filtered(allUsers).length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground p-4">No users to add</p>
                ) : filtered(allUsers).map((u) => (
                  <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-muted rounded-md">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback>{u.first_name?.[0]}{u.last_name?.[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{u.first_name} {u.last_name}</p>
                      {u.roles && u.roles.length > 0 && (
                        <p className="text-xs text-muted-foreground">{u.roles.join(", ")}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => addMember(u.id)}
                      disabled={busyId === u.id}
                    >
                      {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4 mr-1" /> Add</>}
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="media">
              <ScrollArea className="h-[440px] border rounded-md p-3">
                {media.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground p-4">No files shared yet</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                    {media.map((a) => (
                      <div key={a.id} className="border rounded-md overflow-hidden">
                        {a.file_type.startsWith("image/") ? (
                          <a href={a.file_url} target="_blank" rel="noreferrer">
                            <img src={a.thumb_url || a.file_url} alt={a.file_name} loading="lazy" className="w-full h-24 object-cover" />
                          </a>
                        ) : a.file_type.startsWith("video/") ? (
                          <video src={a.file_url} controls preload="metadata" className="w-full h-24 object-cover" />
                        ) : (
                          <div className="h-24 flex items-center justify-center bg-muted">
                            {fileIcon(a.file_type)}
                          </div>
                        )}
                        <a
                          href={a.file_url}
                          download={a.file_name}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-xs p-1.5 truncate hover:bg-muted"
                          title={a.file_name}
                        >
                          <Download className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{a.file_name}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ManageGroupDialog;
