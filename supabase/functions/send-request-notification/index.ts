import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type"};
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 try{
  const auth=req.headers.get("Authorization"); if(!auth)return json({error:"Não autenticado."},401);
  const url=Deno.env.get("SUPABASE_URL"), key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), resend=Deno.env.get("RESEND_API_KEY"), from=Deno.env.get("MAIL_FROM");
  if(!url||!key||!resend||!from)return json({error:"Serviço de e-mail não configurado."},503);
  const {solicitacaoId,type}=await req.json() as {solicitacaoId?:string;type?:"nova"|"decidida"};
  if(!solicitacaoId||!type)return json({error:"Parâmetros inválidos."},400);
  const db=createClient(url,key);const token=auth.replace(/^Bearer\s+/i,"");const {data:user,error:userError}=await db.auth.getUser(token);if(userError||!user.user)return json({error:"Sessão inválida."},401);
  const {data:s}=await db.from("solicitacoes").select("id,created_by,tipo,titulo,status,detalhes").eq("id",solicitacaoId).maybeSingle();if(!s)return json({error:"Solicitação não encontrada."},404);
  const {data:roles}=await db.from("user_roles").select("role").eq("user_id",user.user.id);const admin=(roles??[]).some(r=>r.role==="admin");const direcao=(roles??[]).some(r=>r.role==="direcao");
  if(type==="nova"&&s.created_by!==user.user.id&&!admin)return json({error:"Sem permissão."},403);
  if(type==="decidida"&&!admin&&!direcao)return json({error:"Sem permissão."},403);
  let recipients:string[]=[];
  if(type==="nova"){const {data:ds}=await db.from("user_roles").select("user_id").eq("role","direcao");const ids=(ds??[]).map(x=>x.user_id);if(ids.length){const {data:ps}=await db.from("profiles").select("email").in("id",ids);recipients=(ps??[]).map(p=>p.email).filter((x):x is string=>!!x);}}
  else {const {data:p}=await db.from("profiles").select("email").eq("id",s.created_by).maybeSingle();if(p?.email)recipients=[p.email];}
  if(!recipients.length)return json({ok:true,sent:0});
  const subject=type==="nova"?"Nova solicitação — "+s.titulo:"Solicitação "+(s.status==="aprovada"?"aprovada":"negada")+" — "+s.titulo;
  const html=type==="nova"?`<h2>Nova solicitação</h2><p><strong>Tipo:</strong> ${escapeHtml(s.tipo)}</p><p><strong>Título:</strong> ${escapeHtml(s.titulo)}</p>`:`<h2>Solicitação decidida</h2><p><strong>Título:</strong> ${escapeHtml(s.titulo)}</p><p><strong>Status:</strong> ${escapeHtml(s.status)}</p>`;
  const response=await fetch("https://api.resend.com/emails",{method:"POST",headers:{Authorization:"Bearer "+resend,"Content-Type":"application/json"},body:JSON.stringify({from,to:recipients,subject,html})});
  if(!response.ok)return json({error:"Não foi possível enviar a notificação."},502);return json({ok:true,sent:recipients.length});
 }catch(e){console.error(e);return json({error:"Erro interno."},500);}
});
function escapeHtml(v:string){return v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]??c));}
function json(body:Record<string,unknown>,status=200){return new Response(JSON.stringify(body),{status,headers:{...cors,"Content-Type":"application/json"}});}
