import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase/server';

const DEFAULT_CLIENT_PASSWORD = '123456';

export async function POST(request: Request) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });

    const admin = createSupabaseAdmin();
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Sessão inválida.' }, { status: 401 });
    }

    const { data: actor } = await admin
      .from('profiles')
      .select('role, is_active')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (!actor?.is_active || !['admin', 'receptionist'].includes(actor.role)) {
      return NextResponse.json({ error: 'Sem permissão para cadastrar clientes.' }, { status: 403 });
    }

    const body = await request.json();
    const fullName = String(body.full_name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!fullName || !phone || !email) {
      return NextResponse.json({ error: 'Nome, telefone e e-mail são obrigatórios.' }, { status: 400 });
    }

    const { data: createdAuth, error: createAuthError } = await admin.auth.admin.createUser({
      email,
      password: DEFAULT_CLIENT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'client',
      },
    });

    if (createAuthError || !createdAuth.user) {
      const duplicate = createAuthError?.message.toLowerCase().includes('already');
      return NextResponse.json(
        { error: duplicate ? 'Já existe uma conta com este e-mail.' : createAuthError?.message || 'Erro ao criar acesso do cliente.' },
        { status: duplicate ? 409 : 400 }
      );
    }

    const authUserId = createdAuth.user.id;
    const { error: profileError } = await admin.from('profiles').upsert({
      id: authUserId,
      full_name: fullName,
      phone,
      role: 'client',
      is_active: true,
      must_change_password: true,
    });

    const { data: client, error: clientError } = await admin
      .from('clients')
      .insert({
        auth_user_id: authUserId,
        full_name: fullName,
        phone,
        email,
        birth_date: body.birth_date || null,
        notes: String(body.notes || ''),
      })
      .select('*')
      .single();

    if (profileError || clientError) {
      await admin.auth.admin.deleteUser(authUserId);
      return NextResponse.json(
        { error: profileError?.message || clientError?.message || 'Erro ao salvar cliente.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ client, defaultPassword: DEFAULT_CLIENT_PASSWORD }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno ao cadastrar cliente.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}