'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { 
  Users, 
  Plus, 
  Search,
  Shield,
  Mail,
  MoreVertical,
  Trash2,
  KeyRound,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { createClient } from '@/lib/supabase/client'

type AdminUser = {
  id: string
  email: string
  name: string
  role: 'admin'
  created_at: string
}

export function AdminUserManagement() {
  const [search, setSearch] = useState('')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [showResetPasswordSheet, setShowResetPasswordSheet] = useState(false)
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<AdminUser | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    name: '',
    password: '',
  })
  const [newPassword, setNewPassword] = useState('')

  // Fetch admin users via API
  const fetchAdminUsers = async () => {
    try {
      const response = await fetch('/api/admin/list-users')
      if (!response.ok) {
        return []
      }
      const data = await response.json()
      return Array.isArray(data) ? data : []
    } catch (error) {
      console.error('Error fetching admin users:', error)
      return []
    }
  }

  const { data: adminUsers = [], isLoading } = useSWR('admin-users', fetchAdminUsers)

  const filteredUsers = adminUsers.filter((user: AdminUser) =>
    user.email.toLowerCase().includes(search.toLowerCase()) ||
    user.name.toLowerCase().includes(search.toLowerCase())
  )

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Add new admin user
  const handleAddUser = async () => {
    if (!newUserForm.email || !newUserForm.name || !newUserForm.password) {
      toast.error('Please fill in all fields')
      return
    }

    if (newUserForm.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsAdding(true)

    try {
      const response = await fetch('/api/admin/create-admin-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserForm),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create admin user')
      }

      toast.success('Admin user created successfully')
      setShowAddSheet(false)
      setNewUserForm({ email: '', name: '', password: '' })
      mutate('admin-users')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create admin user')
    } finally {
      setIsAdding(false)
    }
  }

  // Delete admin user
  const handleDeleteUser = async () => {
    if (!deleteConfirm) return

    setIsDeleting(true)

    try {
      const response = await fetch('/api/admin/delete-admin-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deleteConfirm.id }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete admin user')
      }

      toast.success('Admin user deleted')
      setDeleteConfirm(null)
      mutate('admin-users')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete admin user')
    } finally {
      setIsDeleting(false)
    }
  }

  // Reset password
  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) {
      toast.error('Please enter a new password')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsResetting(true)

    try {
      const response = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          newPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      toast.success('Password reset successfully')
      setShowResetPasswordSheet(false)
      setSelectedUser(null)
      setNewPassword('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset password')
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Admin Users</h2>
          <p className="text-sm text-muted-foreground">{adminUsers.length} admin user{adminUsers.length === 1 ? '' : 's'}</p>
        </div>
        <Button onClick={() => setShowAddSheet(true)} className="gap-2 bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90">
          <Plus className="w-4 h-4" />
          Add Admin User
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search admin users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-[var(--bg-card)] border-[var(--border-color)]"
        />
      </div>

      {/* Users List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="w-8 h-8" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No admin users found</h3>
          <p className="text-sm text-muted-foreground">
            {search ? 'Try adjusting your search' : 'Add your first admin user'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user: AdminUser) => (
            <Card key={user.id} className="bg-[var(--bg-card)] border-[var(--border-color)]">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{user.name}</span>
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-500 border-purple-500/30">
                          <Shield className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {user.email}
                      </div>
                    </div>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setSelectedUser(user)
                        setShowResetPasswordSheet(true)
                      }}>
                        <KeyRound className="w-4 h-4 mr-2" />
                        Reset Password
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setDeleteConfirm(user)}
                        className="text-red-500 focus:text-red-500"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Admin User Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent className="bg-background border-l border-border">
          <SheetHeader>
            <SheetTitle>Add Admin User</SheetTitle>
            <SheetDescription>
              Create a new administrator account
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={newUserForm.name}
                onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                placeholder="Full name"
                disabled={isAdding}
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={newUserForm.email}
                onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                placeholder="admin@example.com"
                disabled={isAdding}
              />
            </div>
            <div className="space-y-2">
              <Label>Password *</Label>
              <Input
                type="text"
                value={newUserForm.password}
                onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                placeholder="Min 6 characters"
                disabled={isAdding}
              />
              <p className="text-xs text-muted-foreground">
                Share this password with the user. They can change it after logging in.
              </p>
            </div>
            
            <Button 
              onClick={handleAddUser} 
              className="w-full"
              disabled={isAdding}
            >
              {isAdding ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Admin User
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reset Password Sheet */}
      <Sheet open={showResetPasswordSheet} onOpenChange={(open) => {
        if (!open) {
          setSelectedUser(null)
          setNewPassword('')
        }
        setShowResetPasswordSheet(open)
      }}>
        <SheetContent className="bg-background border-l border-border">
          <SheetHeader>
            <SheetTitle>Reset Password</SheetTitle>
            <SheetDescription>
              Set a new password for {selectedUser?.name}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      {selectedUser ? getInitials(selectedUser.name) : ''}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedUser?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedUser?.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="space-y-2">
              <Label>New Password *</Label>
              <Input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                disabled={isResetting}
              />
            </div>
            
            <Button 
              onClick={handleResetPassword} 
              className="w-full"
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Resetting...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Reset Password
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Admin User?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteConfirm?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-500 hover:bg-red-600"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
