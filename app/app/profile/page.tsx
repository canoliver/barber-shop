'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Save, Upload, Loader2, Lock, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getInitials, getRoleLabel, getRoleColor, maskPhone } from '@/lib/format';

export default function ProfilePage() {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `profiles/${user.id}.${ext}`;
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
      setAvatarUrl(publicUrl);
      const { error: updateErr } = await updateProfile({ avatar_url: publicUrl });
      if (updateErr) throw updateErr;
      toast.success('Foto atualizada!');
    } catch { toast.error('Erro ao enviar foto.'); }
    setUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await updateProfile({ full_name: fullName, phone });
    if (error) toast.error('Erro ao atualizar perfil.');
    else toast.success('Perfil atualizado!');
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) { toast.error('A senha deve ter no mínimo 6 caracteres.'); return; }
    setChangingPass(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast.error('Erro ao alterar senha.');
    else { toast.success('Senha alterada com sucesso!'); setNewPassword(''); }
    setChangingPass(false);
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="Meu Perfil" description="Gerencie seus dados pessoais e senha." />

      <div className="space-y-6">
        {/* Avatar & Basic Info */}
        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-lg flex items-center gap-2"><UserIcon className="h-5 w-5 text-primary" /> Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20 border-2 border-primary/30">
                  {avatarUrl && <AvatarImage src={avatarUrl} alt={fullName} />}
                  <AvatarFallback className="bg-primary/20 text-primary text-2xl font-bold">{getInitials(fullName)}</AvatarFallback>
                </Avatar>
                <label className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full gold-gradient flex items-center justify-center cursor-pointer text-charcoal">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </label>
              </div>
              <div>
                <Badge variant="secondary" className={getRoleColor(user.role)}>{getRoleLabel(user.role)}</Badge>
                <p className="text-sm text-muted-foreground mt-2">Membro desde {new Date(user.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" className="bg-background/50" />
            </div>
            <Button onClick={handleSave} disabled={saving} className="gold-gradient text-charcoal font-semibold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Save className="h-4 w-4 mr-2" /> Salvar Alterações</>}
            </Button>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card className="glass border-border/50 animate-fade-in">
          <CardHeader><CardTitle className="font-playfair text-lg flex items-center gap-2"><Lock className="h-5 w-5 text-primary" /> Alterar Senha</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="bg-background/50" />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPass} variant="outline">
              {changingPass ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Alterar Senha'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
