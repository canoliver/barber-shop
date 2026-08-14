'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { Product } from '@/lib/types';

const CATEGORIES = ['Pomada', 'Shampoo', 'Condicionador', 'Óleo para Barba', 'Cera', 'Pós-Barba', 'Acessórios', 'Outros'];

export function ProductForm({ open, onOpenChange, product, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; product?: Product | null; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('Outros');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (product) {
      setName(product.name); setDescription(product.description); setBrand(product.brand);
      setCategory(product.category); setSku(product.sku); setBarcode(product.barcode);
      setCostPrice(String(product.cost_price).replace('.', ',')); setSellingPrice(String(product.selling_price).replace('.', ','));
      setImageUrl(product.image_url); setIsActive(product.is_active);
    } else {
      setName(''); setDescription(''); setBrand(''); setCategory('Outros'); setSku(''); setBarcode('');
      setCostPrice(''); setSellingPrice(''); setImageUrl(''); setIsActive(true);
    }
  }, [product, open]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `products/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('products').upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('products').getPublicUrl(path);
      setImageUrl(publicUrl);
      toast.success('Imagem enviada!');
    } catch { toast.error('Erro ao enviar imagem.'); }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Nome é obrigatório.'); return; }
    setLoading(true);
    const payload = {
      name, description, brand, category, sku, barcode,
      cost_price: parseFloat(costPrice.replace(',', '.')) || 0,
      selling_price: parseFloat(sellingPrice.replace(',', '.')) || 0,
      image_url: imageUrl, is_active: isActive,
    };
    try {
      if (product) {
        const { error } = await supabase.from('products').update(payload).eq('id', product.id);
        if (error) throw error;
        toast.success('Produto atualizado!');
      } else {
        const { data: newProduct, error } = await supabase.from('products').insert(payload).select().single();
        if (error) throw error;
        // Create inventory record
        await supabase.from('inventory').insert({ product_id: newProduct.id, current_stock: 0, minimum_stock: 5, maximum_stock: 100 });
        toast.success('Produto cadastrado!');
      }
      onSaved(); onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message?.includes('duplicate') ? 'SKU já cadastrado.' : err.message || 'Erro ao salvar.');
    }
    setLoading(false);
  };

  const margin = (parseFloat(sellingPrice.replace(',', '.')) || 0) - (parseFloat(costPrice.replace(',', '.')) || 0);
  const marginPct = (parseFloat(costPrice.replace(',', '.')) || 0) > 0 ? (margin / parseFloat(costPrice.replace(',', '.'))) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong border-border/50 max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="font-playfair text-xl">{product ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
          <DialogDescription>{product ? 'Atualize os dados do produto.' : 'Cadastre um novo produto.'}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {imageUrl ? (
                <img src={imageUrl} alt="Produto" className="w-24 h-24 rounded-xl object-cover border border-border" />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground"><Upload className="h-6 w-6" /></div>
              )}
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full gold-gradient flex items-center justify-center cursor-pointer text-charcoal">
                <Upload className="h-3.5 w-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required className="bg-background/50" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background/50" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="brand">Marca</Label><Input id="brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="bg-background/50" /></div>
            <div className="space-y-2"><Label>Categoria</Label><Select value={category} onValueChange={setCategory}><SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="sku">SKU</Label><Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} className="bg-background/50" /></div>
            <div className="space-y-2"><Label htmlFor="barcode">Código de Barras</Label><Input id="barcode" value={barcode} onChange={(e) => setBarcode(e.target.value)} className="bg-background/50" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="costPrice">Preço de Custo (R$)</Label><Input id="costPrice" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className="bg-background/50" /></div>
            <div className="space-y-2"><Label htmlFor="sellingPrice">Preço de Venda (R$)</Label><Input id="sellingPrice" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} className="bg-background/50" /></div>
          </div>
          {margin !== 0 && (
            <div className="text-sm glass rounded-lg p-3 flex items-center justify-between">
              <span className="text-muted-foreground">Margem de Lucro:</span>
              <span className={`font-bold ${margin > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                R$ {margin.toFixed(2).replace('.', ',')} ({marginPct.toFixed(0)}%)
              </span>
            </div>
          )}
          <div className="flex items-center justify-between"><Label htmlFor="active">Produto ativo</Label><Switch checked={isActive} onCheckedChange={setIsActive} /></div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={loading} className="gold-gradient text-charcoal font-semibold">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
