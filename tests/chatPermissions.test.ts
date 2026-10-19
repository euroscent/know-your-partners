import { test, expect } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

test('employees may mark own messages read but cannot forge replies or alter content', async () => {
  const db=new PGlite();
  await db.exec(`
    CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '11111111-1111-4111-8111-111111111111'::uuid $$;
    CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
    CREATE TABLE public.chat_messages(id integer PRIMARY KEY,user_id uuid,role text,message text,is_read boolean);
    GRANT USAGE ON SCHEMA auth TO authenticated;
    INSERT INTO public.chat_messages VALUES(1,auth.uid(),'admin','Hello',false);
    CREATE POLICY existing_chat_read ON public.chat_messages FOR SELECT TO authenticated USING(user_id=auth.uid());
    CREATE POLICY existing_chat_insert ON public.chat_messages FOR INSERT TO authenticated WITH CHECK(user_id=auth.uid());
  `);
  const sql=readFileSync(new URL('../selfhost/euroscent-firmendaten-chat.sql',import.meta.url),'utf8');
  await db.exec(sql.split('UPDATE public.company_contact')[0]+'COMMIT;');
  await db.exec('SET ROLE authenticated; UPDATE public.chat_messages SET is_read=true WHERE id=1');
  expect((await db.query<{is_read:boolean}>('SELECT is_read FROM public.chat_messages WHERE id=1')).rows[0]?.is_read).toBe(true);
  await expect(db.exec("UPDATE public.chat_messages SET message='Forged' WHERE id=1")).rejects.toThrow('Employees can only change read status');
  await expect(db.exec("INSERT INTO public.chat_messages VALUES(2,auth.uid(),'admin','Forged',false)")).rejects.toThrow();
  await db.exec("INSERT INTO public.chat_messages VALUES(3,auth.uid(),'user','Reply',false)");
  expect((await db.query<{count:number}>('SELECT count(*)::integer AS count FROM public.chat_messages')).rows[0]?.count).toBe(2);
  await db.close();
},30000);