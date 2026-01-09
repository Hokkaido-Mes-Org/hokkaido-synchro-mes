// auth.js - Sistema de Autenticação e Autorização
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.sessionKey = 'synchro_user';
        this.init();
    }

    init() {
        // Verificar se há sessão ativa
        this.loadUserSession();
        
        // Aguardar um pouco para garantir que o sessionStorage foi definido corretamente
        setTimeout(() => {
            const isLoginPage = window.location.pathname.includes('login.html') || window.location.href.includes('login.html');
            
            // Se não houver usuário logado e não estivermos na página de login
            if (!this.currentUser && !isLoginPage) {
                console.log('❌ Nenhuma sessão ativa. Redirecionando para login...');
                this.redirectToLogin();
            }
            
            // Se houver usuário logado e estivermos na página de login
            if (this.currentUser && isLoginPage) {
                console.log('✅ Usuário já logado. Redirecionando para index...');
                this.redirectToIndex();
            }
            
            // Se chegou aqui e está em index.html, filtrar abas baseado em permissões
            if (this.currentUser && !isLoginPage) {
                this.filterTabsBasedOnPermissions();
            }
        }, 100);
    }

    redirectToIndex() {
        window.location.href = 'index.html';
    }

    loadUserSession() {
        // Tentar carregar da localStorage primeiro (remember me)
        let userData = localStorage.getItem(this.sessionKey);
        
        console.log('🔍 [DEBUG] loadUserSession - localStorage:', userData);
        
        // Se não encontrou, tentar sessionStorage
        if (!userData) {
            userData = sessionStorage.getItem(this.sessionKey);
            console.log('🔍 [DEBUG] loadUserSession - sessionStorage:', userData);
        }
        
        if (userData) {
            try {
                this.currentUser = JSON.parse(userData);
                console.log('✅ [DEBUG] Sessão carregada:', this.currentUser);
                this.validateSession();
            } catch (error) {
                console.error('Erro ao carregar sessão do usuário:', error);
                this.logout();
            }
        } else {
            console.warn('⚠️ [DEBUG] Nenhuma sessão encontrada');
        }
    }

    validateSession() {
        if (!this.currentUser) return false;
        
        // Verificar se a sessão não expirou (24 horas para remember me, 8 horas para sessão normal)
        const loginTime = new Date(this.currentUser.loginTime);
        const now = new Date();
        const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
        
        const maxHours = localStorage.getItem(this.sessionKey) ? 24 : 8;
        
        if (hoursDiff > maxHours) {
            this.logout();
            return false;
        }
        
        return true;
    }

    hasPermission(permission) {
        if (!this.currentUser) return false;
        return this.currentUser.permissions.includes(permission);
    }

    isRole(role) {
        if (!this.currentUser) return false;
        return this.currentUser.role === role;
    }

    getCurrentUser() {
        console.log('🔍 [DEBUG] getCurrentUser() chamado:', this.currentUser);
        return this.currentUser;
    }

    setCurrentUser(user) {
        if (user && typeof user === 'object') {
            console.log('🔍 [DEBUG] setCurrentUser() atualizado:', user);
            this.currentUser = user;
        }
    }

    logout() {
        // Limpar dados de sessão
        localStorage.removeItem(this.sessionKey);
        sessionStorage.removeItem(this.sessionKey);
        this.currentUser = null;
        
        // Redirecionar para login
        this.redirectToLogin();
    }

    redirectToLogin() {
        window.location.href = 'login.html';
    }

    // Verificar se o usuário pode acessar uma aba específica
    canAccessTab(tabName) {
        if (!this.currentUser) return false;
        
        // Links externos (sem data-page) são sempre permitidos
        if (!tabName) return true;
        
        // Usuários com acesso total (Leandro Camargo, role 'suporte')
        const isAuthorizedAdmin = 
            this.currentUser.name === 'Leandro Camargo' || this.currentUser.email === 'leandro@hokkaido.com.br' ||
            this.currentUser.role === 'suporte';
        const isGestor = this.currentUser.role === 'gestor' || this.currentUser.role === 'suporte';
        
        // ⚙️ ACESSO EXCLUSIVO: Aba Qualidade apenas para usuários autorizados
        if (tabName === 'qualidade' && !isAuthorizedAdmin) {
            return false;
        }
        
        // ⚙️ ACESSO EXCLUSIVO: Aba Processo apenas para usuários autorizados
        if (tabName === 'processo' && !isAuthorizedAdmin) {
            return false;
        }
        
        // ⚙️ Aba Ajustes: Usuários autorizados ou Gestores
        if (tabName === 'ajustes' && !isAuthorizedAdmin && !isGestor) {
            return false;
        }
        
        // ⚙️ Aba Relatórios: Usuários autorizados ou Gestores
        if (tabName === 'relatorios' && !isAuthorizedAdmin && !isGestor) {
            return false;
        }
        
        // ⚙️ ACESSO EXCLUSIVO: Aba Acompanhamento apenas para usuários específicos
        if (tabName === 'acompanhamento') {
            const allowedUsers = ['Leandro Camargo', 'Michelle Benjamin', 'Tiago Oliveira', 'Davi Batista', 'Luciano'];
            if (!allowedUsers.includes(this.currentUser.name)) {
                return false;
            }
        }

        // ⚙️ ACESSO EXCLUSIVO: Aba Histórico do Sistema apenas para Leandro, Michelle Benjamin e Tiago Oliveira
        if (tabName === 'historico-sistema') {
            const allowedHistorico = ['Leandro Camargo', 'Michelle Benjamin', 'Tiago Oliveira'];
            if (!allowedHistorico.includes(this.currentUser.name)) {
                return false;
            }
        }

        // ⚙️ ACESSO EXCLUSIVO: Aba Admin Dados apenas para Leandro, Michelle Benjamin e Tiago Oliveira
        if (tabName === 'admin-dados') {
            const allowedAdminDados = ['Leandro Camargo', 'Michelle Benjamin', 'Tiago Oliveira'];
            if (!allowedAdminDados.includes(this.currentUser.name)) {
                return false;
            }
        }
        
        const tabPermissions = {
            planejamento: ['planejamento', 'lancamento'], // Operadores também acessam
            ordens: ['planejamento', 'lancamento'],
            lancamento: ['lancamento'],
            analise: ['analise'],
            qualidade: ['analise', 'lancamento'], // Restrito a Leandro acima
            processo: ['analise', 'lancamento'], // Restrito a Leandro acima
            relatorios: ['analise', 'planejamento', 'lancamento'], // Gestores + Leandro
            ajustes: ['planejamento', 'lancamento', 'analise'], // Gestores + Leandro
            'paradas-longas': ['lancamento', 'planejamento', 'analise'],
            'acompanhamento': ['lancamento', 'analise'],
            'historico-sistema': ['analise', 'planejamento'], // Gestores e admins
            'admin-dados': ['planejamento', 'analise'] // Gestores e admins (verificado acima)
        };
        
        const requiredPermissions = tabPermissions[tabName];
        if (!requiredPermissions || requiredPermissions.length === 0) {
            return false;
        }
        
        return requiredPermissions.some(permission => this.hasPermission(permission));
    }

    // Filtrar abas baseado nas permissões do usuário
    filterTabsBasedOnPermissions() {
        if (!this.currentUser) return;
        
        const navButtons = document.querySelectorAll('.nav-btn');
        
        navButtons.forEach(btn => {
            const tabName = btn.getAttribute('data-page');
            
            // Ignorar links externos (sem data-page, como Dashboard TV)
            if (!tabName) return;
            
            if (!this.canAccessTab(tabName)) {
                // Usar múltiplos métodos para garantir ocultação
                btn.style.display = 'none';
                btn.classList.add('hidden');
                btn.setAttribute('disabled', 'true');
                btn.style.visibility = 'hidden';
                btn.style.pointerEvents = 'none';
                
                console.log(`🔒 Aba '${tabName}' ocultada para usuário: ${this.currentUser?.name}`);
                
                // Se a aba ativa está sendo ocultada, mudar para uma permitida
                if (btn.classList.contains('active')) {
                    btn.classList.remove('active');
                    this.setDefaultActiveTab();
                }
            } else {
                // Mostrar aba permitida
                btn.style.display = '';
                btn.classList.remove('hidden');
                btn.removeAttribute('disabled');
                btn.style.visibility = 'visible';
                btn.style.pointerEvents = 'auto';
                
                console.log(`✅ Aba '${tabName}' disponível para usuário: ${this.currentUser?.name}`);
            }
        });

        // Controlar visibilidade do link externo do Dashboard TV (id nav-dashboard-tv)
        try {
            const tvLink = document.getElementById('nav-dashboard-tv');
            // Lista de usuários autorizados a ver o Dashboard TV
            const allowedDashboardUsers = [
                'Leandro Camargo',
                'Tiago Oliveira',
                'Michelle Benjamin'
            ];
            const allowedDashboardEmails = [
                'leandro@hokkaido.com.br',
                'leandro.camargo@hokkaido.com',
                'tiago.oliveira@hokkaido.com',
                'tiago.oliveira@synchro.com',
                'michelle.benjamin@hokkaido.com',
                'michelle.benjamin@synchro.com'
            ];
            
            const canAccessDashboardTV = 
                allowedDashboardUsers.includes(this.currentUser?.name) ||
                allowedDashboardEmails.includes(this.currentUser?.email?.toLowerCase());
            
            if (tvLink) {
                if (canAccessDashboardTV) {
                    tvLink.style.display = '';
                    tvLink.classList.remove('hidden');
                    tvLink.style.visibility = 'visible';
                    console.log('✅ Dashboard TV visível para:', this.currentUser?.name);
                } else {
                    tvLink.style.display = 'none';
                    tvLink.classList.add('hidden');
                    tvLink.style.visibility = 'hidden';
                    console.log('🔒 Dashboard TV oculto para:', this.currentUser?.name);
                }
            }
        } catch (e) {
            console.warn('Não foi possível ajustar visibilidade do Dashboard TV:', e);
        }
        
        // Controlar visibilidade dos botões de lançamento manual
        this.filterManualEntriesButtons();
    }

    // Mostrar/ocultar botões de lançamento manual baseado no usuário
    filterManualEntriesButtons() {
        const manualEntriesContainer = document.getElementById('manual-entries-container');
        if (!manualEntriesContainer) return;
        
        // Usuários com acesso total (Leandro Camargo ou role 'suporte')
        const isAuthorizedAdmin = 
            this.currentUser?.name === 'Leandro Camargo' || this.currentUser?.email === 'leandro@hokkaido.com.br' ||
            this.currentUser?.role === 'suporte';
        
        // Também verificar se tem a permissão específica
        const hasManualPermission = this.currentUser?.permissions?.includes('lançamento_manual_producao');
        
        if (isAuthorizedAdmin || hasManualPermission) {
            manualEntriesContainer.classList.remove('hidden');
            console.log('✅ Botões de lançamento manual visíveis para:', this.currentUser?.name);
        } else {
            manualEntriesContainer.classList.add('hidden');
            console.log('🔒 Botões de lançamento manual ocultos para:', this.currentUser?.name);
        }
    }

    setDefaultActiveTab() {
        const navButtons = document.querySelectorAll('.nav-btn');
        
        // Para operadores, sempre mostrar lançamento como ativo
        if (this.isRole('operador')) {
            const lancamentoBtn = document.querySelector('[data-page="lancamento"]');
            const lancamentoPage = document.getElementById('lancamento-page');
            
            if (lancamentoBtn && lancamentoPage) {
                lancamentoBtn.classList.add('active');
                lancamentoPage.classList.remove('hidden');
                
                // Ocultar outras páginas
                document.querySelectorAll('.page-content').forEach(page => {
                    if (page.id !== 'lancamento-page') {
                        page.classList.add('hidden');
                    }
                });
            }
        } else {
            // Para gestores, manter o comportamento padrão (lançamento como página inicial)
            const lancamentoBtn = document.querySelector('[data-page="lancamento"]');
            if (lancamentoBtn) {
                lancamentoBtn.classList.add('active');
            }
        }
    }

    // Atualizar interface com informações do usuário
    updateUserInterface() {
        if (!this.currentUser) return;
        
        // Adicionar informações do usuário no cabeçalho
        this.addUserInfoToHeader();
        
        // Filtrar abas baseado nas permissões
        this.filterTabsBasedOnPermissions();
        
        // Adicionar botão de logout
        this.addLogoutButton();
    }

    addUserInfoToHeader() {
        const legacyContainer = document.getElementById('user-info');
        if (legacyContainer) {
            legacyContainer.remove();
        }

        const nameEl = document.getElementById('header-user-name');
        const roleChip = document.getElementById('header-user-role-chip');
        const avatarEl = document.getElementById('header-user-avatar');

        if (!nameEl && !roleChip && !avatarEl) {
            // header custom não disponível nesta página
            return;
        }

        const name = this.currentUser?.name?.trim() || 'Usuário';
        if (nameEl) {
            nameEl.textContent = name;
        }

        if (avatarEl) {
            const initials = name
                .split(' ')
                .filter(Boolean)
                .map(part => part[0])
                .join('')
                .substring(0, 2)
                .toUpperCase();
            avatarEl.textContent = initials || 'US';
        }

        if (roleChip) {
            const role = (this.currentUser?.role || '').toLowerCase();
            const roleLabel = role ? role.replace(/\b\w/g, l => l.toUpperCase()) : 'Sem Função';
            roleChip.textContent = roleLabel;

            const roleStyles = {
                gestor: 'bg-blue-100 text-blue-700 ring-1 ring-blue-200',
                operador: 'bg-green-100 text-green-700 ring-1 ring-green-200',
                supervisor: 'bg-purple-100 text-purple-700 ring-1 ring-purple-200'
            };

            const baseClasses = 'inline-flex items-center justify-end rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide';
            roleChip.className = `${baseClasses} ${roleStyles[role] || 'bg-gray-100 text-gray-700 ring-1 ring-gray-200'}`;
        }

        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
        }
    }

    addLogoutButton() {
        const logoutBtn = document.getElementById('logout-btn');
        if (!logoutBtn || logoutBtn.dataset.bound === 'true') {
            return;
        }

        logoutBtn.addEventListener('click', () => {
            if (confirm('Deseja realmente sair do sistema?')) {
                this.logout();
            }
        });

        logoutBtn.dataset.bound = 'true';
        lucide.createIcons();
    }

    // Verificar permissões antes de executar ações sensíveis
    checkPermissionForAction(action) {
        const actionPermissions = {
            'create_planning': 'planejamento',
            'edit_planning': 'planejamento',
            'delete_planning': 'planejamento',
            'create_production_order': 'planejamento',
            'add_production': 'lancamento',
            'add_losses': 'lancamento',
            'add_downtime': 'lancamento',
            'add_rework': 'lancamento',
            'adjust_executed': 'lancamento',
            'view_analysis': 'analise',
            'export_data': 'analise',
            'close_production_order': 'mixed',
            'submit_quality': 'analise',
            'view_quality': 'analise'
        };
        
        const requiredPermission = actionPermissions[action];
        
        if (action === 'close_production_order') {
            const userPerms = this.currentUser?.permissions || [];
            const canClose = userPerms.includes('planejamento') || userPerms.includes('lancamento');
            if (!canClose) {
                this.showPermissionError();
                return false;
            }
            return true;
        }
        
        if (!this.hasPermission(requiredPermission)) {
            this.showPermissionError();
            return false;
        }
        
        return true;
    }

    showPermissionError() {
        // Criar modal de erro de permissão
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg p-6 max-w-md mx-4 shadow-2xl">
                <div class="flex items-center gap-3 mb-4">
                    <div class="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <i class="w-6 h-6 text-red-600" data-lucide="shield-x"></i>
                    </div>
                    <div>
                        <h3 class="font-bold text-lg text-gray-900">⛔ Acesso Restrito</h3>
                        <p class="text-sm text-gray-600">Permissão não concedida</p>
                    </div>
                </div>
                <div class="text-sm text-gray-700 mb-6 p-3 bg-red-50 rounded-lg border border-red-200">
                    <p>❌ Esta aba é restrita apenas para usuários autorizados</p>
                </div>
                <button onclick="this.closest('.fixed').remove()" class="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition">
                    Entendido
                </button>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => {
            if (document.body.contains(modal)) lucide.createIcons();
        }, 100);
        setTimeout(() => {
            if (document.body.contains(modal)) {
                modal.remove();
            }
        }, 5000);
    }
}

// Instanciar sistema de autenticação
const authSystem = new AuthSystem();

// Exportar para uso global
window.authSystem = authSystem;