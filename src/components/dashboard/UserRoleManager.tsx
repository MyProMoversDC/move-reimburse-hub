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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import { handleError } from "@/lib/errorHandler";
import { MOVER_ATTRIBUTE_OPTIONS } from "@/components/dashboard/MoverDocumentsTab";

interface User {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  roles: string[];
  mover_attribute: string | null;
}

interface UserRoleManagerProps {
  language: DashboardLanguage;
}

const availableRoles = ["mover", "admin", "accountant", "operations_manager", "reviews_admin", "hr_manager", "office_staff", "warehouse_keeper"] as const;

const roleColors: Record<string, string> = {
  mover: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  admin: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  accountant: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  operations_manager: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  reviews_admin: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300",
  hr_manager: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300",
  office_staff: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300",
  warehouse_keeper: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
};

const roleDisplayNames: Record<string, string> = {
  mover: "Mover",
  admin: "Admin",
  accountant: "Accountant",
  operations_manager: "Operations Manager",
  reviews_admin: "Customer Review Manager",
  hr_manager: "HR Manager",
  office_staff: "Office Staff",
  warehouse_keeper: "Warehouse Keeper",
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
      const usersWithRoles = (profiles || []).map((profile: any) => ({
        ...profile,
        mover_attribute: profile.mover_attribute ?? null,
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
    const role = selectedRole[userId] as "mover" | "admin" | "accountant" | "operations_manager" | "reviews_admin" | "hr_manager" | "office_staff" | "warehouse_keeper";
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
        .eq("role", role as "mover" | "admin" | "accountant" | "operations_manager" | "reviews_admin" | "hr_manager" | "office_staff" | "warehouse_keeper");

      if (error) throw error;

      toast.success("Role removed successfully");
      fetchUsers();
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setRemovingRole(null);
    }
  };

  const handleAttributeChange = async (userId: string, value: string) => {
    const newVal = value === "__none__" ? null : value;
    const prev = users;
    setUsers((arr) => arr.map((u) => (u.id === userId ? { ...u, mover_attribute: newVal } : u)));
    const { error } = await supabase
      .from("profiles")
      .update({ mover_attribute: newVal } as any)
      .eq("id", userId);
    if (error) {
      setUsers(prev);
      toast.error(handleError(error));
    } else {
      toast.success("Attribute updated");
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
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
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} alt={`${user.first_name} ${user.last_name}`} />
                        <AvatarFallback className="text-xs">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span>{user.first_name} {user.last_name}</span>
                    </div>
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
                            {roleDisplayNames[role] || role.replace("_", " ")}
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
                      <SearchableSelect
                        value={selectedRole[user.id] || ""}
                        onValueChange={(value) =>
                          setSelectedRole({ ...selectedRole, [user.id]: value })
                        }
                        options={availableRoles
                          .filter((role) => !user.roles.includes(role))
                          .map((role) => ({
                            value: role,
                            label: roleDisplayNames[role] || role.replace("_", " "),
                          }))}
                        placeholder="Select role"
                        searchPlaceholder="Search roles..."
                        emptyMessage="No roles available"
                        triggerClassName="w-[180px]"
                      />
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
