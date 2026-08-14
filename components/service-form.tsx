'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { Service } from '@/lib/types';

const CATEGORIES = ['Corte', 'Barba', 'Combo', 'Tratamento', 'Coloração', 'Outros'];

interface ServiceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
  onSaved: () => void;
}

export function ServiceForm({ open, onOpenChange, service, onSaved }: ServiceFormProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('Corte');
  const [isActive, setIsActive] = useState(true);
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    if (service) {
      setName(service.name);
      setDescription(service.description);
      setDuration(String(service.duration_minutes));
      setPrice(String(service.price).replace('.', ','));
      setCategory(service.category);
      setIsActive(service.is_active);
      setImageUrl(service.image_url);
    } else {
      resetForm();
    }
  }, [service, open]);

  const resetForm = () => {
    setName('');
    setDescription('');
    setDuration('30');
    setPrice('');
    setCategory('Corte');
    setIsActive(true);
    setImageUrl('');
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setLoading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `services/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('services').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('services').getPublicUrl(path);
      setImageUrl(publicUrl);
      toast.success('Imagem enviada com sucesso!');
    } catch {
      toast.error('Erro ao enviar imagem.');
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nome do serviço é obrigatório.');
      return;
    }
    setLoading(true);
    const payload = {
      name,
      description,
      duration_minutes: parseInt(duration) || 30,
      price: parseFloat(price.replace(',', '.')) || 0,
      category,
      is_active: isActive,
      image_url: imageUrl,
    };

    try {
      if (service) {
        const { error } = await supabase.from('services').update(payload).eq('id', service.id);
        if (error) throw error;
        toast.success('Serviço atualizado com sucesso!');
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) throw error;
        toast.success('Serviço cadastrado com sucesso!');
      }
      onSaved();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar serviço.');
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/50 max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl">{service ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          <DialogDescription>{service ? 'Atualize os dados do serviço.' : 'Cadastre um novo serviço.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Image */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {imageUrl ? (
                <img src={imageUrl} alt="Serviço" className="w-24 h-24 rounded-xl object-cover border border-border" />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                  <Upload className="h-6 w-6" />
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full gold-gradient flex items-center justify-center cursor-pointer text-charcoal">
                <Upload className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">Nome do Serviço *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Corte Masculino" required className="bg-background/50" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do serviço..." className="bg-background/50" rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duração (minutos)</Label>
              <Input id="duration" type="number" min="5" step="5" value={duration} onChange={(e) => setDuration(e.target.value)} className="bg-background/50" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Preço (R$)</Label>
              <Input id="price" type="text" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" className="bg-background/50" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="bg-background/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="active">Serviço ativo</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="gold-gradient text-charcoal font-semibold hover:opacity-90">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
