import {sites,articles,renderSite,sitemap,rss} from './render.mjs';
export async function routeSubsite(ctx) {
 const u=new URL(ctx.request.url),apex='aubcompany.com';
 if((u.hostname.endsWith('.pages.dev')||['localhost','127.0.0.1'].includes(u.hostname))&&sites[u.searchParams.get('site')]){const k=u.searchParams.get('site');u.pathname='/__preview/subsites/'+k+'/';u.search='';return new Response(null,{status:302,headers:{Location:u.href,'X-Robots-Tag':'noindex, follow'}});}
 const match=u.pathname.match(/^\/__preview\/subsites\/(interior|cleaning|demolition|funeral|insurance|shortform)(\/.*)?$/);
 const allowed=[apex,'localhost','127.0.0.1'].includes(u.hostname)||u.hostname.endsWith('.pages.dev');
 const base=match&&allowed?`/__preview/subsites/${match[1]}`:'';
 const key=base?match[1]:u.hostname.endsWith('.'+apex)?u.hostname.slice(0,-apex.length-1):'';
 if(!sites[key])return null;
 const p=base?(match[2]||'/'):u.pathname;
 if(!base&&(p.startsWith('/assets/')||/^\/google[a-z0-9]+(?:\.html)?$/.test(p)))return null;
 if(!['GET','HEAD'].includes(ctx.request.method))return new Response('Method Not Allowed',{status:405,headers:{Allow:'GET, HEAD'}});
 const respond=(body,type='text/html; charset=utf-8',status=200)=>new Response(ctx.request.method==='HEAD'?null:body,{status,headers:{'Content-Type':type,'Cache-Control':base?'no-store':'public, max-age=60','X-Content-Type-Options':'nosniff',...(base?{'X-Robots-Tag':'noindex, follow'}:{})}});
 if(p==='/91a7460f8c9b4e8db4f2a13d67a0c5e2.txt')return respond('91a7460f8c9b4e8db4f2a13d67a0c5e2','text/plain; charset=utf-8');
 if(p==='/robots.txt')return respond(`User-agent: *\nAllow: /\nSitemap: https://${key}.aubcompany.com/sitemap.xml\n`,'text/plain; charset=utf-8');
 if(p==='/sitemap.xml')return respond(sitemap(key),'application/xml; charset=utf-8');
 if(p==='/rss.xml')return respond(rss(key),'application/rss+xml; charset=utf-8');
 const parts=p.split('/').filter(Boolean);
 const exists=p==='/'||p.replace(/\/$/,'')==='/column'||(parts.length===2&&parts[0]==='column'&&(articles[key]||[]).some(a=>a.slug===parts[1]));
 if(exists&&!u.pathname.endsWith('/')){u.pathname+='/';return Response.redirect(u.toString(),301);}
 return respond(renderSite(key,{path:p,previewBase:base,notFound:!exists}),'text/html; charset=utf-8',exists?200:404);
}
