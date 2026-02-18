// Dashboard de Monitoramento de Cache
// Exibe estatísticas do DataStore e CacheManager em tempo real

export function showCacheDashboard(containerId = 'cache-dashboard') {
    let container = document.getElementById(containerId);
    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.style = 'position:fixed;bottom:16px;right:16px;z-index:9999;background:#222;color:#fff;padding:16px;border-radius:8px;box-shadow:0 2px 8px #0008;font-size:13px;max-width:340px;min-width:260px;opacity:0.95;';
        document.body.appendChild(container);
    }
    function render() {
        const ds = window.DataStore?.getStats?.() || {};
        const cm = window.CacheManager?._cache || new Map();
        const cacheKeys = Array.from(cm.keys());
        container.innerHTML = `
            <b>📦 Cache Dashboard</b><br>
            <b>DataStore</b><br>
            Leituras totais: <b>${ds.total||0}</b><br>
            ${Object.entries(ds.byCollection||{}).map(([col,v])=>`${col}: <b>${v}</b>`).join('<br>')}
            <br>Últimas atualizações:<br>
            ${Object.entries(ds.lastUpdates||{}).map(([col,ts])=>`${col}: <span title="${new Date(ts).toLocaleString()}">${ts?new Date(ts).toLocaleTimeString():'-'}</span>`).join('<br>')}
            <hr style="margin:8px 0;">
            <b>CacheManager</b><br>
            Entradas: <b>${cacheKeys.length}</b><br>
            <div style="max-height:80px;overflow:auto;">
            ${cacheKeys.map(k=>`<span title="${k}">${k.length>40?k.slice(0,38)+'…':k}</span>`).join('<br>')}
            </div>
            <button id="cache-dash-reset" style="margin-top:8px;">Reset Stats</button>
            <button id="cache-dash-close" style="float:right;">Fechar</button>
        `;
        document.getElementById('cache-dash-reset').onclick = ()=>{
            window.DataStore?.resetStats?.();
            render();
        };
        document.getElementById('cache-dash-close').onclick = ()=>{
            container.remove();
        };
    }
    render();
    // Atualizar a cada 2s
    const interval = setInterval(()=>{
        if (!document.body.contains(container)) { clearInterval(interval); return; }
        render();
    }, 2000);
}
