import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../public/manual/assets');
const BASE_URL = 'http://localhost:5173';

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function addVisualAnnotations(page, annotations) {
    await page.evaluate((items) => {
        document.querySelectorAll('.manual-annotation-badge, .manual-highlight-box').forEach(el => el.remove());

        items.forEach((item, index) => {
            const el = document.querySelector(item.selector);
            if (!el) return;

            const rect = el.getBoundingClientRect();
            
            const box = document.createElement('div');
            box.className = 'manual-highlight-box';
            box.style.position = 'absolute';
            box.style.left = `${rect.left + window.scrollX - 4}px`;
            box.style.top = `${rect.top + window.scrollY - 4}px`;
            box.style.width = `${rect.width + 8}px`;
            box.style.height = `${rect.height + 8}px`;
            box.style.border = '3px solid #E11D48';
            box.style.borderRadius = '12px';
            box.style.boxShadow = '0 0 15px rgba(225, 29, 72, 0.4)';
            box.style.pointerEvents = 'none';
            box.style.zIndex = '999998';
            document.body.appendChild(box);

            const badge = document.createElement('div');
            badge.className = 'manual-annotation-badge';
            badge.style.position = 'absolute';
            badge.style.zIndex = '999999';
            badge.style.backgroundColor = '#1E293B';
            badge.style.color = '#FFFFFF';
            badge.style.padding = '6px 12px';
            badge.style.borderRadius = '20px';
            badge.style.fontFamily = 'sans-serif';
            badge.style.fontSize = '12px';
            badge.style.fontWeight = 'bold';
            badge.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
            badge.style.display = 'flex';
            badge.style.alignItems = 'center';
            badge.style.gap = '6px';
            badge.style.border = '2px solid #E11D48';

            const num = item.step || (index + 1);
            badge.innerHTML = `<span style="background:#E11D48; color:#fff; width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; font-size:11px; font-weight:900;">${num}</span> ${item.label}`;

            let top = rect.top + window.scrollY - 38;
            let left = rect.left + window.scrollX;

            if (item.position === 'bottom') {
                top = rect.bottom + window.scrollY + 8;
            } else if (item.position === 'right') {
                top = rect.top + window.scrollY;
                left = rect.right + window.scrollX + 12;
            }

            badge.style.top = `${Math.max(10, top)}px`;
            badge.style.left = `${Math.max(10, left)}px`;

            document.body.appendChild(badge);
        });
    }, annotations);
}

async function navigateToRoute(page, routePath) {
    await page.evaluate((path) => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }, routePath);
    await new Promise(r => setTimeout(r, 1500));
}

async function run() {
    console.log('🚀 Iniciando captura de telas autênticas do HotelFlow...');
    const browser = await puppeteer.launch({
        headless: 'new',
        defaultViewport: { width: 1440, height: 900 }
    });

    const page = await browser.newPage();

    try {
        // 1. LOGIN
        console.log('📸 01. Login...');
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0' });
        await new Promise(r => setTimeout(r, 1000));
        
        await addVisualAnnotations(page, [
            { selector: 'form', label: '1. Seleção de perfil e inserção de credenciais', position: 'top', step: 1 },
            { selector: 'button[type="submit"]', label: '2. Clique em Entrar no Sistema', position: 'bottom', step: 2 }
        ]);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '01_login.png') });

        // Fazer Login real digitando nos campos do React
        console.log('🔑 Realizando login no React...');
        await page.click('#email');
        await page.type('#email', 'sarah@hotelflow.com');
        await page.click('#senha');
        await page.type('#senha', 'sarah123');
        await new Promise(r => setTimeout(r, 500));

        await page.click('button[type="submit"]');
        await new Promise(r => setTimeout(r, 2500));

        // 2. DASHBOARD DIRETORA
        console.log('📸 02. Dashboard Diretora...');
        await navigateToRoute(page, '/dashboard');
        await new Promise(r => setTimeout(r, 1500));
        await addVisualAnnotations(page, [
            { selector: '.grid', label: '1. Métricas da operação e cartões de status', position: 'bottom', step: 1 },
            { selector: 'h3', label: '2. Taxa de conclusão e desempenho por Líder', position: 'top', step: 2 }
        ]);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '02_dashboard_diretora.png') });

        // 3. DASHBOARD LÍDER
        console.log('📸 03. Dashboard Líder...');
        await navigateToRoute(page, '/pdca-visual');
        await new Promise(r => setTimeout(r, 1500));
        await addVisualAnnotations(page, [
            { selector: 'main, body', label: '1. Quadro visual PDCA do setor', position: 'bottom', step: 1 }
        ]);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '03_dashboard_lider.png') });

        // 4. NOVA SI (FORMULÁRIO)
        console.log('📸 04. Criar Nova SI...');
        await navigateToRoute(page, '/nova-os');
        await new Promise(r => setTimeout(r, 1500));
        await addVisualAnnotations(page, [
            { selector: '#titulo, input[name="titulo"]', label: '1. Título descritivo da SI', position: 'top', step: 1 },
            { selector: '#departamento, select[name="departamento"]', label: '2. Seleção de Departamento e Líder', position: 'bottom', step: 2 },
            { selector: 'button[type="submit"]', label: '3. Botão para Abrir Solicitação Interna', position: 'top', step: 3 }
        ]);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '04_nova_si_formulario.png') });

        // 5. LISTA DE SIS E FILTROS
        console.log('📸 05. Lista de SIs e Filtros...');
        await navigateToRoute(page, '/ordens');
        await new Promise(r => setTimeout(r, 1500));
        await addVisualAnnotations(page, [
            { selector: '#buscar-si, input[placeholder*="Buscar"], input', label: '1. Barra de busca rápida (Atalho: /)', position: 'bottom', step: 1 },
            { selector: 'button', label: '2. Filtros por Status (Aberto, Em Andamento, Concluído)', position: 'top', step: 2 }
        ]);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '05_lista_si_filtros.png') });

        // 6. MODAL DETALHES SI
        console.log('📸 06. Modal Detalhes SI...');
        const card = await page.$('.animate-fadeIn, div[class*="rounded-"], div[class*="border"]');
        if (card) {
            await card.click().catch(() => {});
            await new Promise(r => setTimeout(r, 1500));
        }
        await addVisualAnnotations(page, [
            { selector: 'div[class*="max-w-3xl"], body', label: '1. Histórico em Timeline, Checklist e Status da SI', position: 'bottom', step: 1 }
        ]);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '06_detalhes_si_modal.png') });

        // 7. APROVAÇÕES KANBAN
        console.log('📸 07. Aprovações Kanban...');
        await navigateToRoute(page, '/aprovacoes');
        await new Promise(r => setTimeout(r, 1500));
        await addVisualAnnotations(page, [
            { selector: 'main, body', label: '1. Colunas do Kanban (Solicitadas, Em Análise, Concluídas)', position: 'bottom', step: 1 }
        ]);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '08_aprovacoes_kanban.png') });

        // 8. POPS E DOCUMENTAÇÕES
        console.log('📸 08. POPs e Documentações...');
        await navigateToRoute(page, '/pops');
        await new Promise(r => setTimeout(r, 1500));
        await addVisualAnnotations(page, [
            { selector: 'main, body', label: '1. Procedimentos Operacionais Padrão (POPs) do Hotel', position: 'top', step: 1 }
        ]);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '10_treinamentos_pops.png') });

        // 9. PAINEL ADMIN
        console.log('📸 09. Painel Admin...');
        await navigateToRoute(page, '/admin');
        await new Promise(r => setTimeout(r, 1500));
        await addVisualAnnotations(page, [
            { selector: 'table, main, body', label: '1. Tabela de Usuários, Cargos e Matriz de Permissões', position: 'top', step: 1 }
        ]);
        await page.screenshot({ path: path.join(OUTPUT_DIR, '11_painel_admin.png') });

        console.log('🎉 Todas as capturas de tela autênticas foram geradas com sucesso!');
    } catch (err) {
        console.error('❌ Erro:', err);
    } finally {
        await browser.close();
    }
}

run();
