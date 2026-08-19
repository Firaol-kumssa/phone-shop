import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useDeactivateUser, useReactivateUser, useRegisterUser, useStaff } from '@/hooks/useStaff';
import { useAuth } from '@/hooks/useAuth';

const EMPTY_FORM = {
  fullName: '',
  phoneNumber: '',
  digitalId: '',
  username: '',
  password: '',
  role: 'SalesStaff' as 'Admin' | 'SalesStaff',
};

const ROLE_LABEL: Record<string, string> = { Admin: 'Admin', SalesStaff: 'Sales Staff' };

export function StaffPage() {
  const { user: me } = useAuth();
  const { data: staff, isLoading, isError, error } = useStaff();
  const registerUser = useRegisterUser();
  const deactivate = useDeactivateUser();
  const reactivate = useReactivateUser();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (me?.role !== 'Admin') {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Staff management is available to Admin accounts only (Blueprint 11.2).
        </CardContent>
      </Card>
    );
  }

  async function submitNewEmployee() {
    setFormError(null);
    if (!form.fullName.trim() || !form.username.trim() || !form.password) {
      setFormError('Full name, username, and password are required.');
      return;
    }
    if (form.password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    try {
      await registerUser.mutateAsync({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        password: form.password,
        role: form.role,
        phoneNumber: form.phoneNumber.trim() || undefined,
        digitalId: form.digitalId.trim() || undefined,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not create the account');
    }
  }

  async function submitDeactivate(userId: number) {
    setActionError(null);
    try {
      await deactivate.mutateAsync(userId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not deactivate');
    }
  }

  async function submitReactivate(userId: number) {
    setActionError(null);
    try {
      await reactivate.mutateAsync(userId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reactivate');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Manage Staff</h1>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <Plus className="h-4 w-4" />
          New employee
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New employee</CardTitle>
            <CardDescription>
              One login per staff member — shared accounts break the audit trail (Blueprint 13.2).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <Label htmlFor="s-name">Full name</Label>
                <Input
                  id="s-name"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-phone">Phone number (optional)</Label>
                <Input
                  id="s-phone"
                  value={form.phoneNumber}
                  onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-digital">Digital ID (optional)</Label>
                <Input
                  id="s-digital"
                  value={form.digitalId}
                  onChange={(e) => setForm({ ...form, digitalId: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-username">Username</Label>
                <Input
                  id="s-username"
                  autoComplete="off"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-password">Password (min 8 chars)</Label>
                <Input
                  id="s-password"
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="s-role">Role</Label>
                <select
                  id="s-role"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as 'Admin' | 'SalesStaff' })
                  }
                >
                  <option value="SalesStaff">Sales Staff</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>
            {formError && <p className="text-sm text-destructive">{formError}</p>}
            <Button disabled={registerUser.isPending} onClick={submitNewEmployee}>
              {registerUser.isPending ? 'Creating…' : 'Create account'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All users{staff ? ` (${staff.length})` : ''}</CardTitle>
          <CardDescription>
            Accounts are deactivated, never deleted — their sales history stays intact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {actionError && <p className="mb-2 text-sm text-destructive">{actionError}</p>}
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {isError && <p className="text-sm text-destructive">{error.message}</p>}
          {staff && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Digital ID</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((employee) => (
                  <TableRow key={employee.userId}>
                    <TableCell className="font-medium">{employee.fullName}</TableCell>
                    <TableCell>{employee.username}</TableCell>
                    <TableCell>{employee.phoneNumber ?? '—'}</TableCell>
                    <TableCell>{employee.digitalId ?? '—'}</TableCell>
                    <TableCell>{ROLE_LABEL[employee.role] ?? employee.role}</TableCell>
                    <TableCell>
                      <Badge variant={employee.status === 'Active' ? 'success' : 'destructive'}>
                        {employee.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {employee.userId === me?.userId ? (
                        <span className="text-xs text-muted-foreground">You</span>
                      ) : employee.status === 'Active' ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={deactivate.isPending}
                          onClick={() => submitDeactivate(employee.userId)}
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={reactivate.isPending}
                          onClick={() => submitReactivate(employee.userId)}
                        >
                          Reactivate
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
