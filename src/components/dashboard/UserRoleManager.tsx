import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import { handleError } from "@/lib/errorHandler";

interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  roles: string[];
}

interface UserRoleManagerProps {
  language: DashboardLanguage;
}

const availableRoles = ["mover", "admin", "accountant", "operations_manager"] as const;

const roleColors: Record<string, string> = {
  mover: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  accountant: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  operations_manager: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
};

const UserRoleManager = ({ language }: UserRoleManagerProps) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
  const [addingRole, setAddingRole] = useState<string | null>(null);
  const [removingRole, setRemovingRole] = useState<{ userId: string; role: string } | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("first_name");

      if (profilesError) throw profilesError;

      // Fetch all user roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Map roles to users
      const usersWithRoles = (profiles || []).map((profile) => ({
        ...profile,
        roles: (roles || [])
          .filter((r) => r.user_id === profile.id)
          .map((r) => r.role),
      }));

      setUsers(usersWithRoles);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleAddRole = async (userId: string) => {
    const role = selectedRole[userId] as "mover" | "admin" | "accountant" | "operations_manager";
    if (!role) {
      toast.error("Please select a role to add");
      return;
    }

    setAddingRole(userId);

    try {
      const { error } = await supabase.from("user_roles").insert([{
        user_id: userId,
        role: role,
      }]);

      if (error) {
        if (error.code === "23505") {
          toast.error("User already has this role");
        } else {
          throw error;
        }
      } else {
        toast.success("Role added successfully");
        setSelectedRole({ ...selectedRole, [userId]: "" });
        fetchUsers();
      }
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setAddingRole(null);
    }
  };

  const handleRemoveRole = async (userId: string, role: string) => {
    setRemovingRole({ userId, role });

    try {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as "mover" | "admin" | "accountant" | "operations_manager");

      if (error) throw error;

      toast.success("Role removed successfully");
      fetchUsers();
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setRemovingRole(null);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Role Management</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Current Roles</TableHead>
              <TableHead>Add Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.first_name} {user.last_name}
                  </TableCell>
                  <TableCell>{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length === 0 ? (
                        <span className="text-muted-foreground text-sm">No roles</span>
                      ) : (
                        user.roles.map((role) => (
                          <Badge
                            key={role}
                            className={`${roleColors[role] || ""} cursor-pointer group`}
                            onClick={() => handleRemoveRole(user.id, role)}
                          >
                            {role.replace("_", " ")}
                            {removingRole?.userId === user.id && removingRole?.role === role ? (
                              <span className="ml-1">...</span>
                            ) : (
                              <Trash2 className="ml-1 h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={selectedRole[user.id] || ""}
                        onValueChange={(value) =>
                          setSelectedRole({ ...selectedRole, [user.id]: value })
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          {availableRoles
                            .filter((role) => !user.roles.includes(role))
                            .map((role) => (
                              <SelectItem key={role} value={role}>
                                {role.replace("_", " ")}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        onClick={() => handleAddRole(user.id)}
                        disabled={!selectedRole[user.id] || addingRole === user.id}
                      >
                        <UserPlus className="h-4 w-4 mr-1" />
                        {addingRole === user.id ? "Adding..." : "Add"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default UserRoleManager;
