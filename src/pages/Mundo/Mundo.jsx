import { useEffect, useMemo, useState, useRef } from 'react';
import {
    Gamepad2,
    Users,
    Sparkles,
    User,
    Check,
    X,
    ConciergeBell,
    Home,
    Wrench,
    Utensils,
    Award,
    ChevronRight,
    MapPin,
    Heart,
    Briefcase,
    Megaphone,
    Shirt,
    ShoppingCart,
    Sliders,
    DollarSign
} from 'lucide-react';
import AppLayout from '../../components/Layout/AppLayout';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useUsers } from '../../context/UsersContext';
import { useOS } from '../../context/OSContext';
import {
    subscribeMundoPresence,
    updateMundoPresence,
    removeMundoPresence,
    subscribeRoomLayout,
    updateRoomLayout,
    subscribeSentInvitations,
    sendMundoInvitation
} from '../../services/mundoStorage';
import { useNavigate } from 'react-router-dom';

// Tamanho da sala (5x5 grid)
const BOARD_SIZE = 5;
const TILE_WIDTH = 80;
const TILE_HEIGHT = 40;

// Setores/Salas do Mundo
const ROOMS_CONFIG = {
    'Recepção': {
        icon: ConciergeBell,
        color: 'from-blue-600 to-sky-500',
        bg: '#1e293b',
        description: 'Lobby de entrada e atendimento inicial do hotel.',
        tips: 'Caminhe até o Portal Azul brilhante no chão para viajar para outros setores!'
    },
    'Hospedagem': {
        icon: Home,
        color: 'from-sky-600 to-blue-400',
        bg: '#0f172a',
        description: 'Setor de reservas, quartos e controle de hóspedes.',
        tips: 'Ande até o portal para mudar de setor.'
    },
    'Governança': {
        icon: Home,
        color: 'from-amber-500 to-yellow-500',
        bg: '#451a03',
        description: 'Organização de enxovais, arrumação e limpeza.',
        tips: 'Líderes debatem padrões de governança no sofá da sala.'
    },
    'Manutenção': {
        icon: Wrench,
        color: 'from-rose-500 to-orange-400',
        bg: '#4c0519',
        description: 'Reparos elétricos, hidráulicos e infraestrutura.',
        tips: 'Ande até o totem de ferramentas (engrenagem) no canto para abrir uma SI!'
    },
    'Restaurante': {
        icon: Utensils,
        color: 'from-emerald-600 to-teal-500',
        bg: '#064e3b',
        description: 'Serviço de buffet, café da manhã e atendimento.',
        tips: 'Submeta feedbacks operacionais ou alinhe a mise en place.'
    },
    'A&B': {
        icon: Utensils,
        color: 'from-teal-650 to-emerald-555',
        bg: '#022c22',
        description: 'Alimentos e Bebidas corporativo e cozinha.',
        tips: 'Converse sobre custos de alimentos e padrões de receitas.'
    },
    'Financeiro': {
        icon: DollarSign,
        color: 'from-purple-600 to-indigo-500',
        bg: '#311042',
        description: 'Controle de caixas, sangrias e lançamentos.',
        tips: 'Use o computador isométrico para revisar relatórios.'
    },
    'RH': {
        icon: Users,
        color: 'from-pink-600 to-rose-450',
        bg: '#500724',
        description: 'Integração de colaboradores e políticas de equipe.',
        tips: 'Converse sobre as metas de treinamentos operacionais.'
    },
    'Compras e Suprimentos': {
        icon: ShoppingCart,
        color: 'from-cyan-600 to-teal-400',
        bg: '#083344',
        description: 'Cotações de mercadorias, insumos e estoque.',
        tips: 'Gerencie suprimentos passeando pela sala.'
    },
    'Controle': {
        icon: Sliders,
        color: 'from-violet-600 to-fuchsia-500',
        bg: '#1e1b4b',
        description: 'Fluxos de auditoria interna e qualidade de processos.',
        tips: 'Verifique os relatórios operacionais no escritório.'
    },
    'Qualidade': {
        icon: Award,
        color: 'from-yellow-600 to-amber-500',
        bg: '#3f2c00',
        description: 'Pesquisas de satisfação e auditorias de excelência.',
        tips: 'Avalie feedbacks de hóspedes em tempo real.'
    },
    'Comercial': {
        icon: Briefcase,
        color: 'from-indigo-600 to-blue-500',
        bg: '#172554',
        description: 'Reservas corporativas, eventos e contas comerciais.',
        tips: 'Feche novos contratos corporativos aqui.'
    },
    'Marketing': {
        icon: Megaphone,
        color: 'from-orange-655 to-rose-500',
        bg: '#431407',
        description: 'Campanhas promocionais e comunicação de branding.',
        tips: 'Alinhe as estratégias de redes sociais e vendas.'
    },
    'Lavanderia': {
        icon: Shirt,
        color: 'from-sky-500 to-cyan-400',
        bg: '#0c4a6e',
        description: 'Tratamento de enxovais e fardamentos do hotel.',
        tips: 'Verifique se as máquinas industriais estão operando bem.'
    },
    'TI': {
        icon: Sliders,
        color: 'from-blue-600 to-indigo-500',
        bg: '#020617',
        description: 'Segurança digital, redes e suporte técnico.',
        tips: 'Monitore os servidores do hotel na central de TI.'
    },
    'Eventos': {
        icon: Gamepad2,
        color: 'from-fuchsia-600 to-pink-500',
        bg: '#2d0630',
        description: 'Organização de salões de festas e palestras.',
        tips: 'Crie ordens para montagens de coffee breaks.'
    },
    'Diretoria': {
        icon: Award,
        color: 'from-amber-600 to-yellow-500',
        bg: '#1c1917',
        description: 'Sala de reuniões executivas e assinaturas estratégicas.',
        tips: 'Clique no totem dourado no topo da sala para abrir o painel de aprovações de SIs!'
    }
};

// Componente para renderizar o Avatar em SVG Super Elaborado (Habbo Style)
function AvatarSvg({ style, size = 48, className = '', isWalking = false, isSitting = false, isWorking = false, showMsg = false }) {
    const {
        gender = 'masculino',
        skinColor = '#FDBA74',
        hairStyle = 'short',
        hairColor = '#1e293b',
        shirtStyle = 'tshirt',
        shirtColor = '#0A3D62',
        pantsColor = '#1E293B',
        shoesColor = '#0f172a',
        accessory = 'none'
    } = style || {};

    const bounceClass = isWalking ? 'animate-habbo-walk' : '';

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 100 100"
            className={`${className} ${bounceClass} overflow-visible transition-transform`}
            shapeRendering="crispEdges"
        >
            {/* Sombreamento no chão (losango de pixels escuros) */}
            {!isSitting && <polygon points="20,92 50,85 80,92 50,99" fill="rgba(0,0,0,0.25)" />}

            {/* Pernas e Calças */}
            <g id="legs">
                {/* Perna Esquerda */}
                <g id="leg-left" style={{ transformOrigin: '41px 66px' }} className={isWalking ? 'animate-leg-swing-left' : ''}>
                    {isSitting ? (
                        <>
                            <rect x="33" y="66" width="14" height="10" fill={pantsColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            <rect x="33" y="74" width="10" height="12" fill={pantsColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            <rect x="29" y="84" width="14" height="6" fill={shoesColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                        </>
                    ) : gender === 'masculino' ? (
                        <>
                            <rect x="35" y="66" width="12" height="22" fill={pantsColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            <polygon points="31,87 47,87 47,91 31,91" fill={shoesColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                        </>
                    ) : (
                        <>
                            <rect x="38" y="70" width="8" height="18" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            <polygon points="31,87 47,87 47,91 31,91" fill={shoesColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                        </>
                    )}
                </g>

                {/* Perna Direita */}
                <g id="leg-right" style={{ transformOrigin: '59px 66px' }} className={isWalking ? 'animate-leg-swing-right' : ''}>
                    {isSitting ? (
                        <>
                            <rect x="53" y="66" width="14" height="10" fill={pantsColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            <rect x="57" y="74" width="10" height="12" fill={pantsColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            <rect x="57" y="84" width="14" height="6" fill={shoesColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                        </>
                    ) : gender === 'masculino' ? (
                        <>
                            <rect x="53" y="66" width="12" height="22" fill={pantsColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            <polygon points="53,87 69,87 69,91 53,91" fill={shoesColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                        </>
                    ) : (
                        <>
                            <rect x="54" y="70" width="8" height="18" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            <polygon points="53,87 69,87 69,91 53,91" fill={shoesColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                        </>
                    )}
                </g>

                {/* Saia/Shorts (Apenas Feminino em pé) */}
                {!isSitting && gender === 'feminino' && (
                    <polygon points="32,60 68,60 64,72 36,72" fill={pantsColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                )}
            </g>

            {/* Grupo Superior (Deslocado para baixo 6px se estiver sentado) */}
            <g transform={isSitting ? "translate(0, 6)" : undefined}>
                {/* Tronco / Roupas */}
                <g id="torso">
                    {/* Terno Premium HF (Estilo da Foto de Referência) */}
                    {shirtStyle === 'hf-suit' ? (
                        <>
                            <rect x="28" y="40" width="44" height="26" fill="#ffffff" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            <polygon points="43,40 57,40 50,49" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            
                            {/* Blazer por cima */}
                            <polygon points="28,40 44,40 47,54 36,66 28,66" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            <polygon points="72,40 56,40 53,54 64,66 72,66" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

                            {/* Badge/Emblema HF Dourado no peito esquerdo */}
                            <g transform="translate(32, 45)">
                                <rect x="0" y="0" width="10" height="6" fill="#fbbf24" stroke="#000" strokeWidth="1" strokeLinejoin="miter" />
                                <text x="5" y="5.2" fill="#000000" fontSize="4.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace" style={{ userSelect: 'none' }}>HF</text>
                            </g>
                        </>
                    ) : gender === 'masculino' ? (
                        <>
                            {shirtStyle === 'suit' && (
                                <>
                                    <rect x="28" y="40" width="44" height="26" fill="#ffffff" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <polygon points="43,40 57,40 50,49" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <polygon points="48,45 52,45 50,60" fill="#ef4444" stroke="#000" strokeWidth="1" />
                                    <polygon points="28,40 43,40 46,54 36,66 28,66" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <polygon points="72,40 57,40 54,54 64,66 72,66" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                </>
                            )}
                            {shirtStyle === 'hoodie' && (
                                <>
                                    <rect x="26" y="38" width="48" height="28" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="36" y="52" width="28" height="10" fill="rgba(0,0,0,0.2)" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                </>
                            )}
                            {shirtStyle === 'tshirt' && (
                                <>
                                    <rect x="28" y="40" width="44" height="26" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <polygon points="44,40 56,40 50,48" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {shirtStyle === 'dress' ? (
                                <>
                                    <polygon points="34,40 66,40 70,62 30,62" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <polygon points="43,40 57,40 50,48" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                </>
                            ) : shirtStyle === 'jacket' ? (
                                <>
                                    <rect x="30" y="40" width="40" height="24" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <polygon points="44,40 56,40 50,48" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <polygon points="30,40 40,40 42,54 30,54" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" opacity="0.3" />
                                    <polygon points="70,40 60,40 58,54 70,54" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" opacity="0.3" />
                                </>
                            ) : (
                                <>
                                    <rect x="32" y="40" width="36" height="14" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="34" y="54" width="32" height="6" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                </>
                            )}
                        </>
                    )}
                </g>

                {/* Braço Esquerdo */}
                <g id="arm-left" style={{ transformOrigin: '24px 40px' }} className={isWalking ? 'animate-arm-swing-left' : ''}>
                    {gender === 'masculino' ? (
                        <rect x="20" y="40" width="9" height="18" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    ) : (
                        <rect x="23" y="40" width="8" height="14" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    )}
                    <rect x="21" y="54" width="8" height="8" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" className={isWorking ? "animate-typing-left" : ""} />
                </g>

                {/* Braço Direito */}
                <g id="arm-right" style={{ transformOrigin: '75px 40px' }} className={isWalking ? 'animate-arm-swing-right' : ''}>
                    {gender === 'masculino' ? (
                        <rect x="71" y="40" width="9" height="18" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    ) : (
                        <rect x="69" y="40" width="8" height="14" fill={shirtColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    )}
                    <rect x="71" y="54" width="8" height="8" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" className={isWorking ? "animate-typing-right" : ""} />
                </g>

                {/* Pescoço */}
                <rect x="45" y="33" width="10" height="8" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

                {/* Cabelo Parte de Trás (atrás da cabeça/ombros) */}
                <g id="hair-back" fill={hairColor}>
                    {hairStyle === 'ponytail' && (
                        <polygon points="66,22 72,28 72,42 64,46 64,30" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    )}
                </g>

                {/* Cabeça */}
                <rect x="36" y="15" width="28" height="24" fill={skinColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

                {/* Detalhes Rosto */}
                <rect x="42" y="23" width="3" height="3" fill="#000" />
                <rect x="55" y="23" width="3" height="3" fill="#000" />
                {showMsg ? (
                    <ellipse cx="50" cy="31" rx="4" ry="2.5" fill="#000" className="animate-mouth-talking" style={{ transformOrigin: '50px 31px' }} />
                ) : (
                    <path d="M 45,31 L 55,31" stroke="#000" strokeWidth="1.5" strokeLinecap="square" />
                )}

                {/* Cílios e Sobrancelhas (Feminino) */}
                {gender === 'feminino' && (
                    <g stroke="#000" strokeWidth="1" fill="none">
                        <line x1="40" y1="21" x2="45" y2="21" />
                        <line x1="55" y1="21" x2="60" y2="21" />
                        <rect x="41" y="27" width="3" height="1.5" fill="#f43f5e" stroke="none" opacity="0.4" />
                        <rect x="56" y="27" width="3" height="1.5" fill="#f43f5e" stroke="none" opacity="0.4" />
                    </g>
                )}

                {/* Cabelos Elaborados */}
                <g id="hair" fill={hairColor}>

                    {gender === 'masculino' ? (
                        <>
                            {hairStyle === 'short' && (
                                <polygon points="32,22 32,10 50,6 68,10 68,22 60,14 50,16 40,14" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            )}
                            {hairStyle === 'spiky' && (
                                <polygon points="32,22 30,16 35,10 40,14 45,8 50,12 55,8 60,14 65,10 70,16 68,22" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            )}
                            {hairStyle === 'pompadour' && (
                                <polygon points="32,22 30,10 40,2 50,4 60,2 70,10 68,22 50,12" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                            )}
                            {hairStyle === 'dreads' && (
                                <g>
                                    <polygon points="32,22 32,10 50,6 68,10 68,22" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="28" y="18" width="5" height="15" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="67" y="18" width="5" height="15" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="34" y="21" width="4" height="18" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="62" y="21" width="4" height="18" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                </g>
                            )}
                            {hairStyle === 'cap' && (
                                <>
                                    <polygon points="32,22 32,12 50,8 68,12 68,22" fill="#ef4444" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <polygon points="50,16 78,20 70,25 50,22" fill="#b91c1c" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            {hairStyle === 'ponytail' && (
                                <>
                                    <polygon points="32,22 32,10 50,6 68,10 68,22 50,12" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="64" y="20" width="4" height="4" fill="#ec4899" stroke="#000" strokeWidth="1" />
                                </>
                            )}
                            {hairStyle === 'braids' && (
                                <>
                                    <polygon points="32,22 32,10 50,6 68,10 68,22" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="29" y="22" width="6" height="8" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="27" y="29" width="6" height="8" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="29" y="36" width="6" height="6" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="65" y="22" width="6" height="8" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="67" y="29" width="6" height="8" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="65" y="36" width="6" height="6" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                </>
                            )}
                            {hairStyle === 'straight' && (
                                <>
                                    <polygon points="32,22 32,10 50,6 68,10 68,22" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="30" y="20" width="6" height="28" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="64" y="20" width="6" height="28" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                </>
                            )}
                            {hairStyle === 'bob' && (
                                <>
                                    <polygon points="32,22 32,10 50,6 68,10 68,22" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="30" y="20" width="6" height="15" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <rect x="64" y="20" width="6" height="15" fill={hairColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                                    <path d="M 33,18 L 33,15 L 37,15 L 37,12 L 63,12 L 63,15 L 67,15 L 67,18" fill="none" stroke="#ec4899" strokeWidth="2.5" strokeLinejoin="miter" />
                                </>
                            )}
                        </>
                    )}
                </g>

                {/* Acessórios */}
                {accessory === 'glasses' && (
                    <g stroke="#000" strokeWidth="1.5" fill="none" strokeLinejoin="miter">
                        <rect x="39" y="21" width="8" height="6" fill="rgba(14,165,233,0.4)" stroke="#000" strokeWidth="1.5" />
                        <rect x="53" y="21" width="8" height="6" fill="rgba(14,165,233,0.4)" stroke="#000" strokeWidth="1.5" />
                        <line x1="47" y1="24" x2="53" y2="24" />
                        <line x1="39" y1="24" x2="35" y2="22" />
                        <line x1="61" y1="24" x2="65" y2="22" />
                    </g>
                )}

                {/* Headset de Escritório (Microfone + Fone de Ouvido) da Referência */}
                {accessory === 'headset' && (
                    <g fill="none" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter">
                        {/* Arco do headset */}
                        <path d="M 33,20 L 33,14 L 37,14 L 37,10 L 63,10 L 63,14 L 67,14 L 67,20" fill="none" stroke="#000" strokeWidth="2.5" strokeLinejoin="miter" />
                        {/* Espuma do fone esquerdo */}
                        <rect x="31" y="20" width="5" height="10" fill="#000000" stroke="#000" strokeWidth="1.5" />
                        {/* Espuma do fone direito */}
                        <rect x="64" y="20" width="5" height="10" fill="#000000" stroke="#000" strokeWidth="1.5" />
                        {/* Haste do microfone */}
                        <path d="M 33,26 L 33,34 L 42,34" stroke="#000" strokeWidth="1.5" strokeLinecap="square" />
                        {/* Ponta do microfone */}
                        <rect x="42" y="32" width="3" height="3" fill="#ef4444" stroke="#000" strokeWidth="1" />
                    </g>
                )}

                {/* Óculos de Grau */}
                {accessory === 'nerd-glasses' && (
                    <g stroke="#000" strokeWidth="1.5" fill="none" strokeLinejoin="miter">
                        <rect x="39" y="21" width="8" height="6" fill="rgba(255,255,255,0.75)" stroke="#000" strokeWidth="1.5" />
                        <rect x="53" y="21" width="8" height="6" fill="rgba(255,255,255,0.75)" stroke="#000" strokeWidth="1.5" />
                        <line x1="47" y1="24" x2="53" y2="24" />
                        <line x1="39" y1="24" x2="35" y2="22" />
                        <line x1="61" y1="24" x2="65" y2="22" />
                        <line x1="40" y1="22" x2="43" y2="25" stroke="#fff" strokeWidth="1" />
                        <line x1="54" y1="22" x2="57" y2="25" stroke="#fff" strokeWidth="1" />
                    </g>
                )}

                {/* Coroa de Ouro */}
                {accessory === 'crown' && (
                    <g fill="#fbbf24" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter">
                        <polygon points="34,16 34,6 39,11 44,4 50,11 56,4 61,11 66,6 66,16" />
                        <rect x="43" y="6" width="2" height="2" fill="#ef4444" stroke="none" />
                        <rect x="55" y="6" width="2" height="2" fill="#3b82f6" stroke="none" />
                        <rect x="49" y="12" width="2" height="2" fill="#10b981" stroke="none" />
                    </g>
                )}

                {/* Laço de Cabelo */}
                {accessory === 'bow' && (
                    <g fill="#f43f5e" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter">
                        <polygon points="56,12 60,15 56,18" />
                        <polygon points="64,12 60,15 64,18" />
                        <rect x="59" y="13" width="3" height="3" fill="#ec4899" stroke="#000" strokeWidth="1" />
                    </g>
                )}

                {/* Cachecol Vermelho */}
                {accessory === 'scarf' && (
                    <g stroke="#000" strokeWidth="1.5" strokeLinejoin="miter">
                        <rect x="42" y="34" width="16" height="6" fill="#ef4444" />
                        <rect x="52" y="40" width="6" height="12" fill="#ef4444" />
                        <rect x="46" y="34" width="4" height="6" fill="#ffffff" stroke="none" />
                        <rect x="52" y="44" width="6" height="4" fill="#ffffff" stroke="none" />
                    </g>
                )}

                {/* Máscara de Proteção */}
                {accessory === 'mask' && (
                    <g fill="#38bdf8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter">
                        <rect x="42" y="27" width="16" height="10" rx="1" />
                        <line x1="44" y1="30" x2="56" y2="30" stroke="#0284c7" strokeWidth="1" />
                        <line x1="44" y1="34" x2="56" y2="34" stroke="#0284c7" strokeWidth="1" />
                        <line x1="42" y1="29" x2="36" y2="27" stroke="#94a3b8" strokeWidth="1" />
                        <line x1="42" y1="35" x2="36" y2="33" stroke="#94a3b8" strokeWidth="1" />
                        <line x1="58" y1="29" x2="64" y2="27" stroke="#94a3b8" strokeWidth="1" />
                        <line x1="58" y1="35" x2="64" y2="33" stroke="#94a3b8" strokeWidth="1" />
                    </g>
                )}

                {/* Bigode Clássico */}
                {accessory === 'mustache' && (
                    <g fill="#000" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter">
                        <path d="M 44,30 L 46,28 L 50,30 L 54,28 L 56,30 L 54,32 L 50,31 L 46,32 Z" />
                    </g>
                )}
            </g>
        </svg>
    );
}

// Helper to determine the furniture type based on the room and position
const getFurnitureTypeForRoom = (room, positionKey) => {
    if (positionKey === 'furn_0_0') {
        switch (room) {
            case 'Recepção': return 'reception_desk';
            case 'Governança': return 'cleaning_cart';
            case 'Manutenção': return 'tool_bench';
            case 'Restaurante':
            case 'A&B':
                return 'buffet_counter';
            case 'Financeiro': return 'safe_box';
            case 'RH': return 'meeting_table';
            case 'Compras e Suprimentos': return 'cleaning_cart';
            case 'Controle':
            case 'Qualidade':
            case 'Comercial':
                return 'office_desk';
            case 'Marketing': return 'office_desk';
            case 'Lavanderia': return 'industrial_washer';
            case 'TI': return 'server_rack';
            case 'Eventos': return 'events_stage';
            case 'Diretoria': return 'director_desk';
            case 'Hospedagem': return 'reception_desk';
            default: return 'office_desk';
        }
    } else if (positionKey === 'furn_0_4') {
        switch (room) {
            case 'Recepção':
            case 'Hospedagem':
            case 'Qualidade':
            case 'A&B':
                return 'monstera_plant';
            case 'Diretoria': return 'bonsai_tree';
            case 'Governança': return 'file_cabinet';
            case 'RH': return 'file_cabinet';
            case 'TI': return 'server_rack'; // double servers in TI
            case 'Financeiro': return 'office_desk';
            case 'Marketing': return 'leather_sofa';
            default: return 'monstera_plant';
        }
    } else if (positionKey === 'furn_4_4') {
        switch (room) {
            case 'Recepção':
            case 'Hospedagem':
            case 'Governança':
            case 'Marketing':
                return 'leather_sofa';
            default: return null;
        }
    }
    return null;
};

// Component to render highly detailed isometric 3D building base (laje & fachada)
function BuildingBaseSvg() {
    return (
        <svg className="absolute inset-0 overflow-visible z-0" width="100%" height="100%" shapeRendering="crispEdges">
            {/* Concrete Floor Slab (Top Surface) */}
            <polygon points="240,80 440,180 240,280 40,180" fill="#e2e8f0" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
            
            {/* Skyscraper Facade (Left and Right sides extending down to 2000px) */}
            {/* Left Face */}
            <polygon points="40,180 240,280 240,2000 40,2000" fill="#f8fafc" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
            {/* Right Face */}
            <polygon points="240,280 440,180 440,2000 240,2000" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

            {/* Slab Thickness Detail */}
            <polygon points="40,180 240,280 240,295 40,195" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
            <polygon points="240,280 440,180 440,195 240,295" fill="#64748b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

            {/* Horizontal Floor Lines (Slab margins for lower floors) */}
            {/* Floor 1 */}
            <line x1="40" y1="255" x2="240" y2="355" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="355" x2="440" y2="255" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 2 */}
            <line x1="40" y1="315" x2="240" y2="415" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="415" x2="440" y2="315" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 3 */}
            <line x1="40" y1="375" x2="240" y2="475" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="475" x2="440" y2="375" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 4 */}
            <line x1="40" y1="435" x2="240" y2="535" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="535" x2="440" y2="435" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 5 */}
            <line x1="40" y1="495" x2="240" y2="595" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="595" x2="440" y2="495" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 6 */}
            <line x1="40" y1="555" x2="240" y2="655" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="655" x2="440" y2="555" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 7 */}
            <line x1="40" y1="615" x2="240" y2="715" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="715" x2="440" y2="615" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 8 */}
            <line x1="40" y1="675" x2="240" y2="775" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="775" x2="440" y2="675" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 9 */}
            <line x1="40" y1="735" x2="240" y2="835" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="835" x2="440" y2="735" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 10 */}
            <line x1="40" y1="795" x2="240" y2="895" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="895" x2="440" y2="795" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 11 */}
            <line x1="40" y1="855" x2="240" y2="955" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="955" x2="440" y2="855" stroke="#64748b" strokeWidth="1.5" />
            {/* Floor 12 */}
            <line x1="40" y1="915" x2="240" y2="1015" stroke="#94a3b8" strokeWidth="1.5" />
            <line x1="240" y1="1015" x2="440" y2="915" stroke="#64748b" strokeWidth="1.5" />

            {/* Windows on Lower Floors - Left Face (Slope: dy = 0.5 * dx) */}
            {/* Floor 1 Windows */}
            <polygon points="65,222.5 105,242.5 105,262.5 65,242.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="120,250 160,270 160,290 120,270" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="175,277.5 215,297.5 215,317.5 175,297.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 2 Windows */}
            <polygon points="65,282.5 105,302.5 105,322.5 65,302.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="120,310 160,330 160,350 120,330" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="175,337.5 215,357.5 215,377.5 175,357.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 3 Windows */}
            <polygon points="65,342.5 105,362.5 105,382.5 65,362.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="120,370 160,390 160,410 120,390" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="175,397.5 215,417.5 215,437.5 175,417.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 4 Windows */}
            <polygon points="65,402.5 105,422.5 105,442.5 65,422.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="120,430 160,450 160,470 120,450" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="175,457.5 215,477.5 215,497.5 175,477.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 5 Windows */}
            <polygon points="65,462.5 105,482.5 105,502.5 65,482.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="120,490 160,510 160,530 120,510" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="175,517.5 215,537.5 215,557.5 175,537.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 6 Windows */}
            <polygon points="65,522.5 105,542.5 105,562.5 65,542.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="120,550 160,570 160,590 120,570" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="175,577.5 215,597.5 215,617.5 175,597.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 7 Windows */}
            <polygon points="65,582.5 105,602.5 105,622.5 65,602.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="120,610 160,630 160,650 120,630" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="175,637.5 215,657.5 215,677.5 175,657.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 8 Windows */}
            <polygon points="65,642.5 105,662.5 105,682.5 65,662.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="120,670 160,690 160,710 120,690" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="175,697.5 215,717.5 215,737.5 175,717.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Windows on Lower Floors - Right Face (Slope: dy = -0.5 * dx) */}
            {/* Floor 1 Windows */}
            <polygon points="265,297.5 305,277.5 305,297.5 265,317.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="320,270 360,250 360,270 320,290" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="375,242.5 415,222.5 415,242.5 375,262.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 2 Windows */}
            <polygon points="265,357.5 305,337.5 305,357.5 265,377.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="320,330 360,310 360,330 320,350" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="375,302.5 415,282.5 415,302.5 375,322.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 3 Windows */}
            <polygon points="265,417.5 305,397.5 305,417.5 265,437.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="320,390 360,370 360,390 320,410" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="375,362.5 415,342.5 415,362.5 375,382.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 4 Windows */}
            <polygon points="265,477.5 305,457.5 305,477.5 265,497.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="320,450 360,430 360,450 320,470" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="375,402.5 415,382.5 415,402.5 375,422.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 5 Windows */}
            <polygon points="265,537.5 305,517.5 305,537.5 265,557.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="320,510 360,490 360,510 320,530" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="375,462.5 415,442.5 415,462.5 375,482.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 6 Windows */}
            <polygon points="265,597.5 305,577.5 305,597.5 265,617.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="320,570 360,550 360,570 320,590" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="375,522.5 415,502.5 415,522.5 375,542.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 7 Windows */}
            <polygon points="265,657.5 305,637.5 305,657.5 265,677.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="320,630 360,610 360,630 320,650" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="375,582.5 415,562.5 415,582.5 375,602.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />

            {/* Floor 8 Windows */}
            <polygon points="265,717.5 305,697.5 305,717.5 265,737.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="320,690 360,670 360,690 320,710" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
            <polygon points="375,642.5 415,622.5 415,642.5 375,662.5" fill="#7dd3fc" stroke="#000" strokeWidth="1.2" />
        </svg>
    );
}

// Component to render highly detailed isometric 3D walls dynamically
function WallSvg({ room, customWallColor = '' }) {
    let leftPaint = '#1e293b';
    let skirtingColor = '#475569';
    let hasLeftWindow = true;
    
    if (room === 'Recepção') {
        leftPaint = '#1e3a8a';
        skirtingColor = '#fbbf24';
    } else if (room === 'Diretoria') {
        leftPaint = '#292524';
        skirtingColor = '#d97706';
        hasLeftWindow = false;
    } else if (room === 'Manutenção') {
        leftPaint = '#450a0a';
        skirtingColor = '#1e293b';
        hasLeftWindow = false;
    } else if (room === 'TI') {
        leftPaint = '#020617';
        skirtingColor = '#10b981';
        hasLeftWindow = false;
    } else if (room === 'Lavanderia') {
        leftPaint = '#0c4a6e';
        skirtingColor = '#cbd5e1';
    } else if (room === 'Restaurante' || room === 'A&B') {
        leftPaint = '#064e3b';
        skirtingColor = '#f59e0b';
    } else if (room === 'Financeiro') {
        leftPaint = '#3b0764';
        skirtingColor = '#fbbf24';
    } else if (room === 'RH') {
        leftPaint = '#500724';
        skirtingColor = '#fda4af';
    } else if (room === 'Eventos') {
        leftPaint = '#4c1d95';
        skirtingColor = '#f472b6';
        hasLeftWindow = false;
    }

    if (customWallColor) {
        leftPaint = customWallColor;
    }

    const rightPaint = leftPaint;

    return (
        <svg className="absolute inset-0 overflow-visible z-0" width="100%" height="100%" shapeRendering="crispEdges">
            <defs>
                <linearGradient id="sunlight-beam" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fef08a" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="#fef08a" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
                </linearGradient>
            </defs>

            {/* Sunlight Projection on Floor */}
            {hasLeftWindow && (
                <polygon 
                    points="70,165 150,205 220,170 140,130" 
                    fill="url(#sunlight-beam)" 
                    className="pointer-events-none"
                />
            )}

            {/* WALL THICKNESS LEFT EDGE CUT */}
            <polygon points="40,60 24,52 24,172 40,180" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

            {/* WALL THICKNESS RIGHT EDGE CUT */}
            <polygon points="440,60 456,52 456,172 440,180" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

            {/* LEFT WALL */}
            <polygon points="240,80 40,180 40,60 240,-40" fill={leftPaint} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
            <polygon points="240,80 40,180 40,172 240,72" fill={skirtingColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

            {/* RIGHT WALL */}
            <polygon points="240,80 440,180 440,60 240,-40" fill={rightPaint} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
            <polygon points="240,80 440,180 440,60 240,-40" fill="rgba(0,0,0,0.18)" className="pointer-events-none" />
            <polygon points="240,80 440,180 440,172 240,72" fill={skirtingColor} stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

            {/* WALL THICKNESS LEFT TOP CAP */}
            <polygon points="40,60 24,52 240,-56 240,-40" fill="#f8fafc" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

            {/* WALL THICKNESS RIGHT TOP CAP */}
            <polygon points="240,-40 240,-56 456,52 440,60" fill="#f8fafc" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />

            {/* WINDOW ON LEFT WALL */}
            {hasLeftWindow && (
                <g transform="translate(0, 20) skewY(26.5)" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" fill="none">
                    {/* Outer frame */}
                    <rect x="70" y="30" width="40" height="60" fill="#475569" />
                    {/* Inner glass panes */}
                    <rect x="74" y="34" width="14" height="24" fill="#7dd3fc" />
                    <rect x="92" y="34" width="14" height="24" fill="#7dd3fc" />
                    <rect x="74" y="62" width="14" height="24" fill="#7dd3fc" />
                    <rect x="92" y="62" width="14" height="24" fill="#7dd3fc" />
                    {/* Light reflection slashes */}
                    <polygon points="74,48 84,34 88,34 74,54" fill="#ffffff" stroke="none" opacity="0.6" />
                    <polygon points="92,48 102,34 106,34 92,54" fill="#ffffff" stroke="none" opacity="0.6" />
                    <polygon points="74,76 84,62 88,62 74,82" fill="#ffffff" stroke="none" opacity="0.6" />
                    <polygon points="92,76 102,62 106,62 92,82" fill="#ffffff" stroke="none" opacity="0.6" />
                </g>
            )}
        </svg>
    );
}

// Component to render highly detailed isometric 3D furniture
function FurnitureSvg({ type, isGlow = false, isOpen = false, displayFloor = 'RC' }) {
    switch (type) {
        case 'reception_desk':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="40,60 76,58 40,78 4,58" fill="rgba(0,0,0,0.25)" />
                    <polygon points="4,58 40,76 40,51 4,33" fill="#0f172a" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,76 76,58 76,33 40,51" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="4,33 40,15 76,33 40,51" fill="#f8fafc" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="25,36 37,30 47,35 35,41" fill="#64748b" stroke="#000" strokeWidth="1" />
                    <polygon points="37,30 37,20 47,25 47,35" fill="#0ea5e9" opacity="0.9" stroke="#000" strokeWidth="1" />
                    <polygon points="46,39 46,37 48,37 48,35 52,35 52,37 54,37 54,39" fill="#fbbf24" stroke="#000" strokeWidth="1" strokeLinejoin="miter" />
                </svg>
            );
        case 'leather_sofa':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="8,62 40,46 72,62 40,78" fill="rgba(0,0,0,0.25)" />
                    <rect x="12" y="60" width="4" height="6" fill="#451a03" stroke="#000" strokeWidth="1" />
                    <rect x="64" y="60" width="4" height="6" fill="#451a03" stroke="#000" strokeWidth="1" />
                    <polygon points="6,48 20,41 24,49 10,56" fill="#78350f" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="6,48 10,56 10,62 6,54" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="10,56 24,49 24,57 10,64" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="74,48 60,41 56,49 70,56" fill="#78350f" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="70,56 74,48 74,54 70,62" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="56,49 70,56 70,64 56,57" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="20,41 40,31 60,41 40,51" fill="#92400e" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="20,41 40,51 40,59 20,49" fill="#78350f" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,51 60,41 60,49 40,59" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <circle cx="30" cy="42" r="1.5" fill="#1e293b" />
                    <circle cx="40" cy="37" r="1.5" fill="#1e293b" />
                    <circle cx="50" cy="42" r="1.5" fill="#1e293b" />
                    <circle cx="35" cy="45" r="1.5" fill="#1e293b" />
                    <circle cx="45" cy="45" r="1.5" fill="#1e293b" />
                    <polygon points="24,51 40,43 56,51 40,59" fill="#b45309" stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
                    <polygon points="24,51 40,59 40,63 24,55" fill="#78350f" stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
                    <polygon points="40,59 56,51 56,55 40,63" fill="#451a03" stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
                    <line x1="40" y1="43" x2="40" y2="63" stroke="#000" strokeWidth="1.2" />
                </svg>
            );
        case 'monstera_plant':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="28,68 52,68 40,74" fill="rgba(0,0,0,0.25)" />
                    <polygon points="28,58 40,52 52,58 40,64" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="28,58 40,64 40,72 28,66" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,64 52,58 52,66 40,72" fill="#475569" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="30,57 40,53 50,57 40,61" fill="#451a03" stroke="#000" strokeWidth="1" />
                    <polygon points="40,55 24,42 28,34 40,48" fill="#047857" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,55 56,42 52,34 40,48" fill="#059669" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,55 40,24 46,26 40,48" fill="#10b981" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,55 26,55 22,48 40,50" fill="#34d399" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                </svg>
            );
        case 'cleaning_cart':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="20,66 60,66 40,72" fill="rgba(0,0,0,0.25)" />
                    <polygon points="20,58 40,48 60,58 40,68" fill="#475569" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="25,55 40,47 40,27 25,35" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,47 55,55 55,35 40,27" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="25,35 40,27 55,35 40,43" fill="#64748b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                </svg>
            );
        case 'tool_bench':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="10,60 40,45 70,60 40,75" fill="rgba(0,0,0,0.25)" />
                    <rect x="18" y="52" width="4" height="15" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <rect x="58" y="52" width="4" height="15" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="10,48 40,33 70,48 40,63" fill="#b45309" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="10,48 40,63 40,68 10,53" fill="#78350f" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,63 70,48 70,53 40,68" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                </svg>
            );
        case 'buffet_counter':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="12,62 40,48 68,62 40,76" fill="rgba(0,0,0,0.25)" />
                    <polygon points="15,60 40,47 40,27 15,40" fill="#78350f" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,47 65,60 65,40 40,27" fill="#92400e" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="15,40 40,27 65,40 40,53" fill="#f8fafc" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                </svg>
            );
        case 'office_desk':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="12,62 40,48 68,62 40,76" fill="rgba(0,0,0,0.25)" />
                    <rect x="18" y="52" width="4" height="15" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <rect x="58" y="52" width="4" height="15" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <rect x="38" y="59" width="4" height="13" fill="#0f172a" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="12,48 40,34 68,48 40,62" fill="#475569" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="12,48 40,62 40,66 12,52" fill="#334155" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,62 68,48 68,52 40,66" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <rect x="38" y="38" width="4" height="8" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="26,34 50,22 50,14 26,26" fill="#0f172a" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon 
                        points="28,32 48,22 48,16 28,26" 
                        fill={isGlow ? "#00ffff" : "#10b981"} 
                        stroke="#000" 
                        strokeWidth={isGlow ? 1.5 : 1}
                        className={isGlow ? "animate-pulse" : ""}
                    />
                    {isGlow && (
                        <>
                            <rect x="32" y="20" width="2" height="2" fill="#ef4444" className="animate-ping" style={{ animationDuration: '0.6s' }} />
                            <rect x="44" y="24" width="2" height="2" fill="#3b82f6" className="animate-ping" style={{ animationDuration: '0.8s' }} />
                        </>
                    )}
                </svg>
            );
        case 'safe_box':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="22,60 40,51 58,60 40,69" fill="rgba(0,0,0,0.3)" />
                    <polygon points="25,52 40,44 40,20 25,28" fill="#475569" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,44 55,52 55,28 40,20" fill="#64748b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="25,28 40,20 55,28 40,36" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="43,42 52,47 52,29 43,24" fill="#334155" stroke="#000" strokeWidth="1" strokeLinejoin="miter" />
                    <circle cx="48" cy="38" r="2.5" fill="#94a3b8" stroke="#000" strokeWidth="1" />
                    <line x1="48" y1="38" x2="44" y2="40" stroke="#000" strokeWidth="2.2" strokeLinecap="round" />
                    <circle cx="47" cy="30" r="2" fill="#fbbf24" stroke="#000" strokeWidth="0.8" />
                    <rect x="44" y="22" width="6" height="4" fill="#1e293b" stroke="#000" strokeWidth="0.8" />
                    <rect x="45" y="23" width="4" height="2" fill="#10b981" />
                </svg>
            );
        case 'meeting_table':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="12,62 40,48 68,62 40,76" fill="rgba(0,0,0,0.25)" />
                    <rect x="25" y="54" width="6" height="13" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <rect x="49" y="54" width="6" height="13" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="10,48 40,33 70,48 40,63" fill="#78350f" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="10,48 40,63 40,66 10,51" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,63 70,48 70,51 40,66" fill="#292524" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                </svg>
            );
        case 'file_cabinet':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="26,58 40,51 40,15 26,22" fill="#64748b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,51 54,58 54,22 40,15" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="26,22 40,15 54,22 40,29" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                </svg>
            );
        case 'industrial_washer':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="24,66 56,66 40,72" fill="rgba(0,0,0,0.25)" />
                    <polygon points="24,56 40,48 40,22 24,30" fill="#64748b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,48 56,56 56,30 40,22" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="24,30 40,22 56,30 40,38" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,28 53,34 53,28 40,22" fill="#334155" stroke="#000" strokeWidth="1" strokeLinejoin="miter" />
                    <rect x="42" y="24" width="3" height="2" fill="#10b981" />
                    <circle cx="48" cy="28" r="1" fill="#ef4444" />
                    <circle cx="51" cy="30" r="1" fill="#fbbf24" />
                    <polygon points="34,42 46,36 46,48 34,54" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="36,44 44,40 44,46 36,50" fill="#0284c7" stroke="#000" strokeWidth="1.2" />
                    <polygon points="38,45 42,43 40,47" fill="#ef4444" opacity="0.8" />
                    <polygon points="41,44 43,46 39,47" fill="#fbbf24" opacity="0.8" />
                    <circle cx="38" cy="46" r="0.8" fill="#ffffff" />
                    <circle cx="42" cy="45" r="0.8" fill="#ffffff" />
                    <line x1="37" y1="48" x2="43" y2="45" stroke="#ffffff" strokeWidth="1" opacity="0.4" />
                </svg>
            );
        case 'server_rack':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="25,66 55,66 40,72" fill="rgba(0,0,0,0.3)" />
                    <polygon points="25,58 40,51 40,11 25,18" fill="#090d16" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,51 55,58 55,18 40,11" fill="#0f172a" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="25,18 40,11 55,18 40,25" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <rect x="43" y="18" width="4" height="2" fill="#10b981" />
                    <rect x="48" y="22" width="4" height="2" fill="#ef4444" className="animate-ping" style={{ animationDuration: '0.8s' }} />
                    <rect x="43" y="32" width="4" height="2" fill="#00ffff" />
                </svg>
            );
        case 'events_stage':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="10,58 40,43 70,58 40,73" fill="rgba(0,0,0,0.25)" />
                    <polygon points="10,48 40,33 70,48 40,63" fill="#d97706" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="10,48 40,63 40,68 10,53" fill="#b45309" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,63 70,48 70,53 40,68" fill="#78350f" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                </svg>
            );
        case 'director_desk':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="10,60 40,45 70,60 40,75" fill="rgba(0,0,0,0.28)" />
                    <polygon points="12,56 40,42 40,26 12,40" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,42 68,56 68,40 40,26" fill="#78350f" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="12,40 40,26 68,40 40,54" fill="#1c1917" stroke="#fbbf24" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="12,40 40,54 40,57 12,43" fill="#78350f" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,54 68,40 68,43 40,57" fill="#451a03" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="30,37 38,33 46,37 38,41" fill={isGlow ? "#00ffff" : "#fbbf24"} stroke="#000" strokeWidth="1.5" className={isGlow ? "animate-pulse" : ""} />
                    <polygon points="38,33 38,25 46,29 46,37" fill="#fbbf24" opacity="0.95" stroke="#000" strokeWidth="1.5" />
                    {isGlow && (
                        <rect x="34" y="31" width="2" height="2" fill="#10b981" className="animate-pulse" />
                    )}
                </svg>
            );
        case 'bonsai_tree':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="26,68 54,68 40,74" fill="rgba(0,0,0,0.2)" />
                    <polygon points="26,62 54,62 50,68 30,68" fill="#44403c" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <path d="M 40,62 L 36,62 L 36,54 L 40,54 L 40,46 L 42,46 L 42,42" fill="none" stroke="#78350f" strokeWidth="4" strokeLinecap="square" strokeLinejoin="miter" />
                    <polygon points="26,36 42,32 46,42 30,46" fill="#15803d" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="34,26 50,22 54,30 38,34" fill="#166534" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="42,20 54,16 58,22 46,26" fill="#22c55e" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                </svg>
            );
        case 'office_chair':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="24,68 56,68 40,76" fill="rgba(0,0,0,0.25)" />
                    <line x1="40" y1="68" x2="28" y2="72" stroke="#000" strokeWidth="2.5" />
                    <line x1="40" y1="68" x2="52" y2="64" stroke="#000" strokeWidth="2.5" />
                    <line x1="40" y1="68" x2="32" y2="63" stroke="#000" strokeWidth="2.5" />
                    <line x1="40" y1="68" x2="48" y2="73" stroke="#000" strokeWidth="2.5" />
                    <line x1="40" y1="68" x2="40" y2="56" stroke="#000" strokeWidth="4" />
                    <polygon points="26,52 40,45 54,52 40,59" fill="#475569" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="26,52 40,59 40,63 26,56" fill="#334155" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,59 54,52 54,56 40,63" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <line x1="40" y1="52" x2="40" y2="32" stroke="#000" strokeWidth="3" />
                    <polygon points="32,24 40,20 48,24 40,28" fill="#64748b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="32,24 40,28 40,42 32,38" fill="#334155" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,28 48,24 48,38 40,42" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                </svg>
            );
        case 'coffee_machine':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="24,68 56,68 40,74" fill="rgba(0,0,0,0.25)" />
                    <polygon points="26,58 40,51 54,58 40,65" fill="#e2e8f0" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="26,58 40,65 40,67 26,60" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,65 54,58 54,60 40,67" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="28,42 40,36 52,42 40,48" fill="#ef4444" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="28,42 40,48 40,54 28,48" fill="#dc2626" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,48 52,42 52,48 40,54" fill="#b91c1c" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="29,56 40,50 51,56 40,62" fill="#475569" stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
                    <rect x="33" y="47" width="2" height="4" fill="#0f172a" />
                    <line x1="33" y1="51" x2="27" y2="54" stroke="#000" strokeWidth="2" strokeLinecap="round" />
                    <rect x="45" y="47" width="2" height="4" fill="#0f172a" />
                    <line x1="45" y1="51" x2="39" y2="54" stroke="#000" strokeWidth="2" strokeLinecap="round" />
                    <line x1="49" y1="46" x2="52" y2="53" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" />
                    <ellipse cx="34" cy="38" rx="2.5" ry="1.5" fill="#ffffff" stroke="#000" strokeWidth="1" />
                    <ellipse cx="46" cy="38" rx="2.5" ry="1.5" fill="#fde047" stroke="#000" strokeWidth="1" />
                    <circle cx="40" cy="46" r="2" fill="#ffffff" stroke="#000" strokeWidth="0.8" />
                </svg>
            );
        case 'whiteboard':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="20,68 60,68 40,73" fill="rgba(0,0,0,0.18)" />
                    <line x1="26" y1="68" x2="26" y2="40" stroke="#000" strokeWidth="2.5" />
                    <line x1="54" y1="68" x2="54" y2="40" stroke="#000" strokeWidth="2.5" />
                    <polygon points="22,48 58,30 58,15 22,33" fill="#ffffff" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <line x1="28" y1="38" x2="38" y2="33" stroke="#2563eb" strokeWidth="1.5" />
                    <line x1="42" y1="31" x2="52" y2="26" stroke="#ef4444" strokeWidth="1.5" />
                </svg>
            );
        case 'rug_red':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="2,60 40,41 78,60 40,79" fill="#b91c1c" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="8,60 40,44 72,60 40,76" fill="#991b1b" stroke="#000" strokeWidth="1" strokeLinejoin="miter" />
                </svg>
            );
        case 'rug_blue':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="2,60 40,41 78,60 40,79" fill="#0A3D62" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="8,60 40,44 72,60 40,76" fill="#0f172a" stroke="#000" strokeWidth="1" strokeLinejoin="miter" />
                </svg>
            );
        case 'elevator':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="40,60 76,58 40,78 4,58" fill="rgba(0,0,0,0.35)" />
                    <polygon points="4,58 40,40 40,3 4,21" fill="#475569" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,40 76,58 76,21 40,3" fill="#64748b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="4,21 40,3 76,21 40,39" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="42,39 74,55 74,21 42,5" fill="#fef08a" opacity="0.85" />
                    <polygon points="50,33 70,43 70,23 50,13" fill="#ca8a04" opacity="0.6" />
                    
                    <g transform={isOpen ? "translate(12, 6)" : undefined} className="transition-transform duration-500 ease-in-out">
                        <polygon points="40,40 76,58 76,21 40,3" fill="#64748b" opacity="0.15" />
                        <polygon points="56,48 76,58 76,21 56,11" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                        <polygon points="54,47 56,48 56,11 54,10" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    </g>
                    
                    <g transform={isOpen ? "translate(-12, -6)" : undefined} className="transition-transform duration-500 ease-in-out">
                        <polygon points="4,58 40,40 40,3 4,21" fill="#475569" opacity="0.15" />
                        <polygon points="4,58 24,48 24,11 4,21" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                        <polygon points="24,48 26,49 26,12 24,11" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    </g>
                    
                    <g transform="translate(33, 13)">
                        <rect x="0" y="0" width="14" height="6" rx="0.5" fill="#0f172a" stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
                        <text x="7" y="5" fill="#ef4444" fontSize="4.5" fontWeight="bold" textAnchor="middle" fontFamily="monospace" className="animate-pulse" style={{ userSelect: 'none' }}>
                            {displayFloor}
                        </text>
                    </g>
                </svg>
            );
        case 'flower_vase':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="28,68 52,68 40,74" fill="rgba(0,0,0,0.25)" />
                    <polygon points="32,58 40,54 48,58 40,62" fill="#ea580c" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="32,58 40,62 40,70 32,66" fill="#c2410c" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,62 48,58 48,66 40,70" fill="#9a3412" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <path d="M 38,56 L 36,44 M 40,56 L 40,40 M 42,56 L 44,46" stroke="#15803d" strokeWidth="2.5" strokeLinecap="round" />
                    <polygon points="32,44 38,41 40,46 34,49" fill="#ef4444" stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
                    <rect x="35" y="44" width="2" height="2" fill="#fbbf24" />
                    <polygon points="37,38 43,35 45,40 39,43" fill="#ec4899" stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
                    <rect x="40" y="38" width="2" height="2" fill="#ffffff" />
                    <polygon points="43,44 49,41 51,46 45,49" fill="#f59e0b" stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
                    <rect x="46" y="44" width="2" height="2" fill="#ef4444" />
                </svg>
            );
        case 'floor_lamp':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="24,70 56,70 40,76" fill="rgba(0,0,0,0.25)" />
                    <polygon points="20,70 40,43 60,70 40,80" fill="#fef08a" opacity="0.25" className="pointer-events-none" />
                    <polygon points="32,66 40,62 48,66 40,70" fill="#e2e8f0" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="32,66 40,70 40,72 32,68" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,70 48,66 48,68 40,72" fill="#64748b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <rect x="39" y="32" width="2" height="34" fill="#334155" stroke="#000" strokeWidth="1.2" strokeLinejoin="miter" />
                    <polygon points="30,22 40,17 50,22 40,27" fill="#fef08a" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="30,22 40,27 40,39 30,34" fill="#fde047" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,27 50,22 50,34 40,39" fill="#eab308" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <circle cx="40" cy="30" r="3" fill="#fef08a" stroke="#000" strokeWidth="1" className="animate-pulse" />
                </svg>
            );
        case 'bookshelf':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="16,64 64,64 40,76" fill="rgba(0,0,0,0.25)" />
                    <polygon points="20,22 40,12 60,22 40,32" fill="#d97706" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="20,22 40,32 40,68 20,58" fill="#b45309" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,32 60,22 60,58 40,68" fill="#78350f" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="20,40 40,30 60,40 40,50" fill="#d97706" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="20,56 40,46 60,56 40,66" fill="#d97706" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    {/* Small plant pot on the top shelf */}
                    <ellipse cx="40" cy="18" rx="3.5" ry="1.8" fill="#f43f5e" stroke="#000" strokeWidth="1" />
                    <path d="M 40,16 L 39,11 M 40,16 L 42,9" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" />
                    {/* Books on Middle Shelf */}
                    <polygon points="25,32 29,30 29,22 25,24" fill="#2563eb" stroke="#000" strokeWidth="1" />
                    <polygon points="29,30 33,28 33,20 29,22" fill="#ef4444" stroke="#000" strokeWidth="1" />
                    <polygon points="33,28 37,26 37,18 33,20" fill="#f59e0b" stroke="#000" strokeWidth="1" />
                    <polygon points="43,26 47,21 47,15 43,20" fill="#10b981" stroke="#000" strokeWidth="1" />
                    {/* Books on Lower Shelf */}
                    <polygon points="25,48 29,46 29,38 25,40" fill="#7c3aed" stroke="#000" strokeWidth="1" />
                    <polygon points="29,46 33,44 33,36 29,38" fill="#0d9488" stroke="#000" strokeWidth="1" />
                    <polygon points="33,44 37,42 37,34 33,36" fill="#ea580c" stroke="#000" strokeWidth="1" />
                    <polygon points="45,38 49,36 49,28 45,30" fill="#f1f5f9" stroke="#000" strokeWidth="1" />
                </svg>
            );
        case 'water_dispenser':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="26,68 54,68 40,75" fill="rgba(0,0,0,0.25)" />
                    <polygon points="28,48 40,42 52,48 40,54" fill="#cbd5e1" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="28,48 40,54 40,70 28,64" fill="#94a3b8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,54 52,48 52,64 40,70" fill="#64748b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="32,58 40,54 40,64 32,68" fill="#334155" stroke="#000" strokeWidth="1" />
                    <polygon points="40,54 48,58 48,68 40,64" fill="#1e293b" stroke="#000" strokeWidth="1" />
                    <rect x="35" y="55" width="2" height="2" fill="#3b82f6" />
                    <rect x="43" y="55" width="2" height="2" fill="#ef4444" />
                    <polygon points="30,24 40,19 50,24 40,29" fill="#7dd3fc" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="30,24 40,29 40,42 30,37" fill="#38bdf8" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,29 50,24 50,37 40,42" fill="#0ea5e9" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="36,45 44,41 44,43 36,47" fill="#1e293b" stroke="#000" strokeWidth="1" />
                    <polygon points="32,27 38,24 38,34 32,37" fill="#ffffff" opacity="0.45" stroke="none" />
                </svg>
            );
        case 'minibar':
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="22,64 58,64 40,73" fill="rgba(0,0,0,0.25)" />
                    <polygon points="24,46 40,38 56,46 40,54" fill="#475569" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="24,46 40,54 40,68 24,60" fill="#334155" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,54 56,46 56,60 40,68" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    {/* Shelves */}
                    <polygon points="26,56 40,49 54,56 40,63" fill="#64748b" opacity="0.8" stroke="#000" strokeWidth="1" />
                    {/* Soda cans on upper shelf */}
                    <rect x="31" y="44" width="3" height="5" fill="#ef4444" stroke="#000" strokeWidth="0.8" />
                    <rect x="35" y="42" width="3" height="5" fill="#10b981" stroke="#000" strokeWidth="0.8" />
                    <rect x="42" y="45" width="3" height="5" fill="#3b82f6" stroke="#000" strokeWidth="0.8" />
                    <rect x="46" y="47" width="3" height="5" fill="#f97316" stroke="#000" strokeWidth="0.8" />
                    {/* Green bottles on lower shelf */}
                    <rect x="33" y="52" width="2.2" height="7" fill="#047857" stroke="#000" strokeWidth="0.8" />
                    <rect x="33.5" y="49" width="1.2" height="3" fill="#047857" />
                    <rect x="45" y="55" width="2.2" height="7" fill="#047857" stroke="#000" strokeWidth="0.8" />
                    <rect x="45.5" y="52" width="1.2" height="3" fill="#047857" />
                    {/* Glass door panels */}
                    <polygon points="25,49 39,56 39,67 25,60" fill="rgba(14,165,233,0.18)" stroke="#000" strokeWidth="1" />
                    <polygon points="39,56 53,49 53,60 39,67" fill="rgba(14,165,233,0.18)" stroke="#000" strokeWidth="1" />
                    <line x1="28" y1="52" x2="36" y2="56" stroke="#ffffff" strokeWidth="1.5" opacity="0.5" />
                    <line x1="42" y1="52" x2="50" y2="48" stroke="#ffffff" strokeWidth="1.5" opacity="0.5" />
                </svg>
            );
        default:
            return (
                <svg width="80" height="80" viewBox="0 0 80 80" className="overflow-visible" shapeRendering="crispEdges">
                    <polygon points="15,62 40,48 65,62 40,76" fill="rgba(0,0,0,0.15)" />
                    <polygon points="15,48 40,34 65,48 40,62" fill="#475569" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="15,48 40,62 40,66 15,52" fill="#334155" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                    <polygon points="40,62 65,48 65,52 40,66" fill="#1e293b" stroke="#000" strokeWidth="1.5" strokeLinejoin="miter" />
                </svg>
            );
    }
}

const isPlayerSittingOnChair = (x, y, furnitureList) => {
    if (!furnitureList || !Array.isArray(furnitureList)) return false;
    return furnitureList.some(f => f.x === x && f.y === y && f.type === 'office_chair');
};

const hasDeskAdjacent = (x, y, furnitureList) => {
    if (!furnitureList || !Array.isArray(furnitureList)) return false;
    const deskTypes = ['reception_desk', 'office_desk', 'director_desk', 'meeting_table', 'buffet_counter', 'tool_bench'];
    return furnitureList.some(f => {
        const isDesk = deskTypes.includes(f.type);
        const isAdj = Math.abs(f.x - x) <= 1 && Math.abs(f.y - y) <= 1;
        return isDesk && isAdj && !(f.x === x && f.y === y);
    });
};

const isDeskActive = (deskX, deskY, playersList, furnitureList) => {
    if (!playersList || !Array.isArray(playersList)) return false;
    return playersList.some(p => {
        const onChair = isPlayerSittingOnChair(p.x, p.y, furnitureList);
        if (!onChair) return false;
        return Math.abs(p.x - deskX) <= 1 && Math.abs(p.y - deskY) <= 1;
    });
};

const getFloorAbbreviation = (roomName) => {
    switch (roomName) {
        case 'Recepção': return 'RC';
        case 'Hospedagem': return 'HP';
        case 'Governança': return 'GV';
        case 'Manutenção': return 'MN';
        case 'Restaurante': return 'RT';
        case 'A&B': return 'AB';
        case 'Financeiro': return 'FN';
        case 'RH': return 'RH';
        case 'Compras e Suprimentos': return 'CP';
        case 'Controle': return 'CT';
        case 'Qualidade': return 'QL';
        case 'Comercial': return 'CM';
        case 'Marketing': return 'MK';
        case 'Lavanderia': return 'LV';
        case 'TI': return 'TI';
        case 'Eventos': return 'EV';
        case 'Diretoria': return 'DR';
        default: return 'HF';
    }
};

const getDefaultLayoutForRoom = (roomName) => {
    const furniture = [];
    const t0 = getFurnitureTypeForRoom(roomName, 'furn_0_0');
    if (t0) furniture.push({ x: 0, y: 0, type: t0 });
    const t1 = getFurnitureTypeForRoom(roomName, 'furn_0_4');
    if (t1) furniture.push({ x: 0, y: 4, type: t1 });
    const t2 = getFurnitureTypeForRoom(roomName, 'furn_4_4');
    if (t2) furniture.push({ x: 4, y: 4, type: t2 });
    return {
        wallColor: '',
        floorPattern: 'standard',
        furniture
    };
};

export default function Mundo() {
    const { user } = useAuth();
    const { addNotification } = useNotification();
    const { currentUserProfile } = useUsers();
    const navigate = useNavigate();

    const profile = currentUserProfile || user;
    const { users, availableDepartments } = useUsers();
    const { criarOS, ordens, solicitarFinalizacao } = useOS();

    // States for multiplayer interactions
    const [showDevWarning, setShowDevWarning] = useState(true);
    const [selectedInteractionPlayer, setSelectedInteractionPlayer] = useState(null);
    const [interactionMenuOpen, setInteractionMenuOpen] = useState(false);
    
    // SI Form States
    const [siFormOpen, setSiFormOpen] = useState(false);
    const [siTitle, setSiTitle] = useState('');
    const [siDesc, setSiDesc] = useState('');
    const [siDept, setSiDept] = useState('');
    const [siPrazo, setSiPrazo] = useState('');
    const [siErrors, setSiErrors] = useState({});
    const [siLoading, setSiLoading] = useState(false);

    // Finalize Form States
    const [finalizeFormOpen, setFinalizeFormOpen] = useState(false);
    const [selectedSIForFinalization, setSelectedSIForFinalization] = useState('');

    // Floating balloons for declines
    const [floatingBalloons, setFloatingBalloons] = useState([]);
    const processedInvitesRef = useRef(new Set());

    // Drag and Pan camera states
    const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStartRef = useRef({ x: 0, y: 0 });

    // Zoom states
    const [zoomScale, setZoomScale] = useState(1);
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const handleWheelEvent = (e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.08 : -0.08;
            setZoomScale((prev) => Math.max(0.5, Math.min(2.0, prev + delta)));
        };

        canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
        return () => {
            canvas.removeEventListener('wheel', handleWheelEvent);
        };
    }, []);

    // Editing placed furniture state
    const [editingFurniture, setEditingFurniture] = useState(null);

    const handleRotateFurniture = (angleStep = 90) => {
        if (!editingFurniture || !roomLayout) return;
        const index = editingFurniture.index;
        const currentRotation = roomLayout.furniture[index].rotation || 0;
        const newRotation = (currentRotation + angleStep) % 360;

        let newFurniture = [...roomLayout.furniture];
        newFurniture[index] = {
            ...newFurniture[index],
            rotation: newRotation
        };

        const updated = {
            ...roomLayout,
            furniture: newFurniture
        };

        setRoomLayout(updated);
        updateRoomLayout(currentRoom, updated).catch(() => {});
        setEditingFurniture({
            ...editingFurniture,
            rotation: newRotation
        });
        addNotification('Mobiliário rotacionado!', 'success');
    };

    const handleRemoveFurniture = () => {
        if (!editingFurniture || !roomLayout) return;
        const index = editingFurniture.index;

        let newFurniture = [...roomLayout.furniture];
        newFurniture.splice(index, 1);

        const updated = {
            ...roomLayout,
            furniture: newFurniture
        };

        setRoomLayout(updated);
        updateRoomLayout(currentRoom, updated).catch(() => {});
        setEditingFurniture(null);
        addNotification('Mobiliário removido!', 'info');
    };

    const handleDragStart = (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select') || e.target.closest('.cursor-pointer')) {
            return;
        }
        setIsDragging(true);
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        dragStartRef.current = {
            x: clientX - panOffset.x,
            y: clientY - panOffset.y
        };
    };

    const handleDragMove = (e) => {
        if (!isDragging) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        const rawX = clientX - dragStartRef.current.x;
        const rawY = clientY - dragStartRef.current.y;
        
        // Limita o movimento da câmera para que o quarto e o prédio fiquem na área visível
        const constrainedX = Math.max(-350, Math.min(350, rawX));
        const constrainedY = Math.max(-250, Math.min(200, rawY));
        
        setPanOffset({
            x: constrainedX,
            y: constrainedY
        });
    };

    const handleDragEnd = () => {
        setIsDragging(false);
    };

    // Auto-switch room from URL query parameter ?room=...
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const targetRoom = params.get('room');
        if (targetRoom && ROOMS_CONFIG[targetRoom]) {
            handleRoomChange(targetRoom);
            window.history.replaceState(null, '', window.location.pathname);
        }
    }, [window.location.search]);

    const addDeclineBalloon = (invite) => {
        const id = invite.id;
        setFloatingBalloons((prev) => [...prev, invite]);
        setTimeout(() => {
            setFloatingBalloons((prev) => prev.filter((b) => b.id !== id));
        }, 8000);
    };

    // Listen to sent chat invites decline feedback
    useEffect(() => {
        const userId = profile?.id || user?.id;
        if (!userId) return;

        const unsubscribe = subscribeSentInvitations(userId, (invites) => {
            invites.forEach((invite) => {
                if (invite.status === 'rejected' && !processedInvitesRef.current.has(invite.id)) {
                    processedInvitesRef.current.add(invite.id);
                    addDeclineBalloon(invite);
                }
            });
        });

        return () => unsubscribe();
    }, [profile, user]);

    const handlePlayerClick = (playerData) => {
        setSelectedInteractionPlayer(playerData);
        setInteractionMenuOpen(true);
    };

    const handleInviteToChat = async () => {
        if (!selectedInteractionPlayer) return;
        
        const inviteId = await sendMundoInvitation(profile || user, selectedInteractionPlayer, currentRoom);
        if (inviteId) {
            addNotification(`Convite de bate-papo enviado para ${selectedInteractionPlayer.nome}!`, 'success');
        } else {
            addNotification('Não foi possível enviar o convite.', 'error');
        }
        setInteractionMenuOpen(false);
    };

    const openSiForm = () => {
        if (!selectedInteractionPlayer) return;
        setSiTitle(`Ajuste solicitado por ${profile?.nome || user?.nome}`);
        setSiDesc('');
        const assigneeProfile = users.find(u => u.id === selectedInteractionPlayer.id);
        const defaultDept = assigneeProfile?.departamentos?.[0] || '';
        setSiDept(defaultDept);
        
        const today = new Date();
        today.setDate(today.getDate() + 3);
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        setSiPrazo(`${year}-${month}-${day}`);
        
        setSiErrors({});
        setSiFormOpen(true);
        setInteractionMenuOpen(false);
    };

    const handleCreateSI = async (e) => {
        e.preventDefault();
        setSiErrors({});
        
        const errs = {};
        if (!siTitle.trim()) errs.titulo = 'Título é obrigatório.';
        if (!siDesc.trim()) errs.descricao = 'Descrição é obrigatória.';
        if (!siDept) errs.departamento = 'Selecione um departamento.';
        if (!siPrazo) errs.prazo = 'Prazo é obrigatório.';
        
        if (Object.keys(errs).length > 0) {
            setSiErrors(errs);
            return;
        }

        setSiLoading(true);
        try {
            const assigneeProfile = users.find(u => u.id === selectedInteractionPlayer.id);
            if (!assigneeProfile) throw new Error('Funcionário não encontrado no sistema.');

            await criarOS(
                {
                    titulo: siTitle.trim(),
                    descricao: siDesc.trim(),
                    departamento: siDept,
                    responsavel_id: assigneeProfile.id,
                    responsavel_uid: assigneeProfile.firebaseUid || assigneeProfile.id,
                    responsavel_email: assigneeProfile.email,
                    responsavel_nome: assigneeProfile.nome,
                    responsavel_telefone: assigneeProfile.telefone || null,
                    responsavel_telegram_chat_id: assigneeProfile.telegram_chat_id || null,
                    co_responsaveis: [],
                    prazo: new Date(`${siPrazo}T23:59:59`).toISOString(),
                    imagem: null
                },
                profile || user
            );

            addNotification(`Nova SI criada e atribuída a ${assigneeProfile.nome}!`, 'success');
            
            await updateMundoPresence(profile?.id || user?.id, {
                message: `Abri uma SI para ${assigneeProfile.nome}! 🛠️`,
                messageTime: new Date().toISOString()
            });

            setSiFormOpen(false);
        } catch (err) {
            addNotification(err.message || 'Erro ao criar SI.', 'error');
        } finally {
            setSiLoading(false);
        }
    };

    const openFinalizeForm = () => {
        setSelectedSIForFinalization('');
        setFinalizeFormOpen(true);
        setInteractionMenuOpen(false);
    };

    // Filter eligible SIs for finalization
    const eligibleSIs = useMemo(() => {
        if (!selectedInteractionPlayer || !profile) return [];
        const myUid = profile.id;
        const myFirebaseUid = profile.firebaseUid || profile.id;
        const myEmail = profile.email?.toLowerCase();

        return ordens.filter((os) => {
            if (os.status !== 'EM_ANDAMENTO') return false;

            const isCreator = os.criado_por_id === selectedInteractionPlayer.id || 
                              os.criado_por_uid === selectedInteractionPlayer.firebaseUid;

            const isMeResp = os.responsavel_id === myUid || 
                             os.responsavel_uid === myFirebaseUid || 
                             os.responsavel_email?.toLowerCase() === myEmail ||
                             (Array.isArray(os.co_responsaveis) && os.co_responsaveis.some(cr => cr.id === myUid || cr.uid === myFirebaseUid || cr.email?.toLowerCase() === myEmail));

            return isCreator && isMeResp;
        });
    }, [selectedInteractionPlayer, profile, ordens]);

    // Filtrar e ordenar funcionários para o diretório
    const hotelStaff = useMemo(() => {
        if (!users) return [];
        return users
            .filter((u) => u.id !== profile?.id && ['LIDER', 'ADMIN', 'DIRETORA'].includes(u.role))
            .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR'));
    }, [users, profile]);

    const handleRequestFinalization = async () => {
        if (!selectedSIForFinalization) return;
        const os = ordens.find(o => o.id === selectedSIForFinalization);
        if (!os) return;

        try {
            await solicitarFinalizacao(os.id, profile || user);
            addNotification(`Solicitação de finalização enviada para a SI: "${os.titulo}"`, 'success');
            
            await updateMundoPresence(profile?.id || user?.id, {
                message: `Solicitei a conclusão da SI: "${os.titulo}"! 📁`,
                messageTime: new Date().toISOString()
            });

            setFinalizeFormOpen(false);
        } catch (err) {
            addNotification(err.message || 'Erro ao solicitar finalização.', 'error');
        }
    };

    // Estados de navegação do Mundo
    const [players, setPlayers] = useState([]);
    const [currentRoom, setCurrentRoom] = useState('Recepção');
    const [myPosition, setMyPosition] = useState({ x: 2, y: 2 });
    const [chatInput, setChatInput] = useState('');
    const [isWalking, setIsWalking] = useState(false);
    
    // Portal de Viagem
    const [showTravelMap, setShowTravelMap] = useState(false);

    // Customização do Avatar
    const [showCustomizer, setShowCustomizer] = useState(false);
    const [avatarStyle, setAvatarStyle] = useState({
        gender: 'masculino',
        skinColor: '#FDBA74',
        hairStyle: 'short',
        hairColor: '#1e293b',
        shirtStyle: 'tshirt',
        shirtColor: '#0A3D62',
        pantsColor: '#1E293B',
        shoesColor: '#0f172a',
        accessory: 'none'
    });

    // Decoração de Sala (Modo Decorar)
    const [isDecorating, setIsDecorating] = useState(false);
    const [selectedCatalogItem, setSelectedCatalogItem] = useState('office_chair');
    const [roomLayout, setRoomLayout] = useState({
        wallColor: '',
        floorPattern: 'standard',
        furniture: []
    });

    const canDecorate = useMemo(() => {
        return profile?.role === 'ADMIN' || profile?.role === 'DIRETORA' || profile?.departamentos?.includes(currentRoom);
    }, [profile, currentRoom]);

    // Subscrever as configurações de decoração da sala ativa no Firestore
    useEffect(() => {
        const unsubscribe = subscribeRoomLayout(currentRoom, (data) => {
            if (data) {
                setRoomLayout({
                    wallColor: data.wallColor || '',
                    floorPattern: data.floorPattern || 'standard',
                    furniture: Array.isArray(data.furniture) ? data.furniture : []
                });
            } else {
                setRoomLayout(getDefaultLayoutForRoom(currentRoom));
            }
        });
        return () => unsubscribe();
    }, [currentRoom]);

    useEffect(() => {
        setEditingFurniture(null);
    }, [isDecorating, currentRoom]);

    const chatTimerRef = useRef(null);
    const walkTimerRef = useRef(null);
    const walkPathRef = useRef([]);

    // Obstáculos da sala atual (onde os bonecos não podem pisar) calculados dinamicamente
    const roomObstacles = useMemo(() => {
        const obs = new Set();
        const nonObstacles = ['office_chair', 'rug_red', 'rug_blue'];

        if (roomLayout && Array.isArray(roomLayout.furniture)) {
            roomLayout.furniture.forEach((f) => {
                if (!nonObstacles.includes(f.type)) {
                    obs.add(`${f.x},${f.y}`);
                }
            });
        }
        return obs;
    }, [roomLayout]);

    // Algoritmo de Busca em Largura (BFS Pathfinding) para encontrar a rota
    const findPath = (start, target) => {
        // Se o próprio alvo for um obstáculo, redireciona o passo para um bloco vizinho
        if (roomObstacles.has(`${target.x},${target.y}`)) {
            const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
            let bestNeighbor = null;
            let bestDist = Infinity;
            for (const [dx, dy] of dirs) {
                const nx = target.x + dx;
                const ny = target.y + dy;
                if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE && !roomObstacles.has(`${nx},${ny}`)) {
                    const dist = Math.abs(nx - start.x) + Math.abs(ny - start.y);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestNeighbor = { x: nx, y: ny };
                    }
                }
            }
            if (bestNeighbor) {
                target = bestNeighbor;
            } else {
                return null;
            }
        }

        const queue = [[start]];
        const visited = new Set([`${start.x},${start.y}`]);

        while (queue.length > 0) {
            const path = queue.shift();
            const curr = path[path.length - 1];

            if (curr.x === target.x && curr.y === target.y) {
                return path;
            }

            const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
            for (const [dx, dy] of dirs) {
                const nx = curr.x + dx;
                const ny = curr.y + dy;
                const key = `${nx},${ny}`;
                if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE && !roomObstacles.has(key) && !visited.has(key)) {
                    visited.add(key);
                    queue.push([...path, { x: nx, y: ny }]);
                }
            }
        }
        return null;
    };

    // Carregar customização inicial salva localmente
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = window.localStorage.getItem(`hotelflow:avatar:${profile?.id}`);
            if (saved) {
                try {
                    setAvatarStyle(JSON.parse(saved));
                } catch {
                    // Mantém padrão
                }
            }
        }
    }, [profile]);

    // Subscrever a presença dos jogadores
    useEffect(() => {
        if (profile?.id) {
            updateMundoPresence(profile.id, {
                nome: profile.nome || 'Líder',
                x: myPosition.x,
                y: myPosition.y,
                room: currentRoom,
                avatarStyle
            }).catch(() => {});
        }

        const unsubscribe = subscribeMundoPresence((data) => {
            setPlayers(data);
        });

        return () => {
            unsubscribe();
            if (profile?.id) {
                removeMundoPresence(profile.id).catch(() => {});
            }
        };
    }, [profile, currentRoom, avatarStyle]);

    // Executa a caminhada física passo a passo ou ação de decoração
    const handleTileClick = (targetX, targetY) => {
        if (isDecorating) {
            // Impedir colocação de móveis no spawn (2,2) ou elevador (4,0)
            if ((targetX === 2 && targetY === 2) || (targetX === 4 && targetY === 0)) {
                addNotification('Não é permitido colocar móveis no Spawn (2,2) ou no Elevador (4,0)!', 'warning');
                return;
            }

            const existingIndex = roomLayout.furniture.findIndex(f => f.x === targetX && f.y === targetY);
            let newFurniture = [...roomLayout.furniture];

            if (existingIndex > -1) {
                setEditingFurniture({
                    x: targetX,
                    y: targetY,
                    index: existingIndex,
                    ...roomLayout.furniture[existingIndex]
                });
                return;
            } else {
                setEditingFurniture(null);
                newFurniture.push({
                    x: targetX,
                    y: targetY,
                    type: selectedCatalogItem,
                    rotation: 0
                });
                addNotification('Mobiliário posicionado!', 'success');
            }

            const updated = {
                ...roomLayout,
                furniture: newFurniture
            };

            setRoomLayout(updated);
            updateRoomLayout(currentRoom, updated).catch(() => {});
            return;
        }

        // Ignora cliques repetidos no mesmo bloco final
        if (targetX === myPosition.x && targetY === myPosition.y) return;

        // Cancela caminhada em progresso
        if (walkTimerRef.current) {
            clearInterval(walkTimerRef.current);
        }

        const path = findPath(myPosition, { x: targetX, y: targetY });
        if (!path || path.length <= 1) return;

        setIsWalking(true);
        walkPathRef.current = path.slice(1); // Ignora ponto inicial

        walkTimerRef.current = setInterval(async () => {
            if (walkPathRef.current.length === 0) {
                clearInterval(walkTimerRef.current);
                setIsWalking(false);
                return;
            }

            const nextStep = walkPathRef.current.shift();
            setMyPosition(nextStep);

            if (profile?.id) {
                await updateMundoPresence(profile.id, {
                    x: nextStep.x,
                    y: nextStep.y,
                    room: currentRoom
                });
            }

            // Se atingir o bloco de portal (4,0) e for o final da jornada, abre o mapa de viagem
            if (nextStep.x === 4 && nextStep.y === 0 && walkPathRef.current.length === 0) {
                clearInterval(walkTimerRef.current);
                setIsWalking(false);
                setShowTravelMap(true);
            }
        }, 220); // Tempo do passo Habbo (220ms)
    };

    // Submissão do chat por balão
    const handleChatSubmit = async (e) => {
        e.preventDefault();
        const text = chatInput.trim();
        if (!text || !profile?.id) return;

        if (chatTimerRef.current) {
            clearTimeout(chatTimerRef.current);
        }

        await updateMundoPresence(profile.id, {
            message: text,
            messageTime: new Date().toISOString()
        });

        setChatInput('');

        chatTimerRef.current = setTimeout(async () => {
            if (profile?.id) {
                await updateMundoPresence(profile.id, {
                    message: '',
                    messageTime: null
                });
            }
        }, 6000);
    };

    // Salvar nova customização de avatar
    const handleSaveAvatar = (newStyle) => {
        setAvatarStyle(newStyle);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(`hotelflow:avatar:${profile?.id}`, JSON.stringify(newStyle));
        }
        if (profile?.id) {
            updateMundoPresence(profile.id, { avatarStyle: newStyle });
        }
        setShowCustomizer(false);
        addNotification('Avatar customizado com sucesso!', 'success');
    };

    // Mudar de sala no Hotel
    const handleRoomChange = async (roomName) => {
        setCurrentRoom(roomName);
        setShowTravelMap(false);
        // Reseta posição de início no centro da sala ao mudar de quarto
        const startPos = { x: 2, y: 2 };
        setMyPosition(startPos);
        if (profile?.id) {
            await updateMundoPresence(profile.id, {
                room: roomName,
                x: startPos.x,
                y: startPos.y
            });
        }
        addNotification(`Bem-vindo ao setor: ${roomName}!`, 'info');
    };

    // Filtra jogadores conectados na mesma sala
    const visiblePlayers = useMemo(() => {
        return players.filter((p) => p.room === currentRoom);
    }, [players, currentRoom]);

    // Função de projeção isométrica para renderizar os objetos nas coordenadas corretas da tela
    const getIsometricPos = (x, y) => {
        const left = (x - y) * (TILE_WIDTH / 2) + 200;
        const top = (x + y) * (TILE_HEIGHT / 2) + 80;
        return { left, top };
    };

    // Construction of depth-sorted render items list
    const sortedEntities = useMemo(() => {
        const items = [];

        // 1. Add furniture items from roomLayout
        if (roomLayout && Array.isArray(roomLayout.furniture)) {
            roomLayout.furniture.forEach((f, idx) => {
                if (f.type) {
                    items.push({
                        id: `furn_${f.x}_${f.y}_${idx}`,
                        x: f.x,
                        y: f.y,
                        type: 'furniture',
                        furnType: f.type,
                        rotation: f.rotation || 0,
                        index: idx
                    });
                }
            });
        }

        // 2. Add elevator portal
        items.push({
            id: 'elevator',
            x: 4,
            y: 0,
            type: 'portal'
        });

        // 3. Add players
        visiblePlayers.forEach(player => {
            const isMe = player.id === profile?.id;
            items.push({
                id: player.id,
                x: player.x,
                y: player.y,
                type: 'player',
                playerData: player,
                isMe
            });
        });

        // Depth sort: x + y. If equal, sort by type order (furniture -> portal -> player)
        items.sort((a, b) => {
            const depthA = a.x + a.y;
            const depthB = b.x + b.y;
            if (depthA !== depthB) {
                return depthA - depthB;
            }
            const typeOrder = { 'furniture': 0, 'portal': 1, 'player': 2 };
            return typeOrder[a.type] - typeOrder[b.type];
        });

        return items;
    }, [currentRoom, visiblePlayers, profile?.id, isWalking, roomLayout]);

    // Configuração da sala atual
    const roomBgColor = ROOMS_CONFIG[currentRoom]?.bg || '#0d1e2d';
    const CurrentRoomIcon = ROOMS_CONFIG[currentRoom]?.icon || ConciergeBell;

    return (
        <AppLayout pageTitle="Mundo HotelFlow">
            {showDevWarning && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-50">
                    <div className="bg-gray-800 p-6 rounded-xl shadow-lg max-w-md text-center text-white">
                        <h2 className="text-xl font-bold mb-4">Desenvolvimento em andamento</h2>
                        <p className="mb-6">Este módulo ainda está em processo de desenvolvimento.</p>
                        <button className="px-4 py-2 bg-hotel-blue text-white rounded hover:bg-hotel-blue/80 transition" onClick={() => setShowDevWarning(false)}>
                            Entendi
                        </button>
                    </div>
                </div>
            )}
            <div className="mx-auto max-w-7xl animate-fadeIn space-y-6">
                
                {/* Header Premium do Jogo */}
                <div 
                    className="relative overflow-hidden rounded-[28px] text-white shadow-[0_20px_50px_rgba(10,61,98,0.15)] border border-white/10"
                    style={{ background: 'linear-gradient(135deg, #062135 0%, #0A3D62 50%, #175e8f 100%)' }}
                >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/[0.03]" />
                    <div className="pointer-events-none absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-hotel-gold/10" />
                    
                    <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">
                                <Gamepad2 size={12} className="text-hotel-gold animate-bounce" /> HotelFlow Universe
                            </div>
                            <h1 className="font-heading text-3xl font-extrabold tracking-tight lg:text-4xl">
                                Mundo HotelFlow
                            </h1>
                            <p className="max-w-2xl text-sm leading-relaxed text-white/70 font-body">
                                Caminhe passo a passo pelas salas do hotel. Converse por balões de conversa e mude de setor andando até o portal luminoso azul.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowCustomizer(true)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-hotel-gold px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-hotel-gold/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-hotel-gold-lt active:scale-95"
                            >
                                <User size={16} /> Customizar Avatar
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowTravelMap(true)}
                                className="inline-flex items-center gap-2 rounded-2xl bg-white/10 border border-white/20 px-6 py-3.5 text-sm font-bold text-white hover:bg-white/20 active:scale-95 transition-all"
                            >
                                Viajar para Setor
                            </button>
                        </div>
                    </div>
                </div>

                {/* Viewport do Jogo */}
                <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                    
                    {/* Tela / Canvas do Quarto */}
                    <div 
                        ref={canvasRef}
                        className={`relative overflow-hidden rounded-[32px] border border-slate-200/80 shadow-2xl h-[500px] flex flex-col justify-between p-6 select-none transition-shadow ${
                            isDragging ? 'cursor-grabbing' : 'cursor-grab'
                        }`}
                        onMouseDown={handleDragStart}
                        onMouseMove={handleDragMove}
                        onMouseUp={handleDragEnd}
                        onMouseLeave={handleDragEnd}
                        onTouchStart={handleDragStart}
                        onTouchMove={handleDragMove}
                        onTouchEnd={handleDragEnd}
                        style={{
                            background: 'linear-gradient(to bottom, #7dd3fc 0%, #bae6fd 40%, #e0f2fe 100%)' // Sky gradient
                        }}
                    >
                        {/* Floating Clouds Background */}
                        <div className="absolute inset-x-0 top-0 h-40 pointer-events-none overflow-hidden opacity-60 z-0">
                            <div className="absolute top-4 left-0 w-24 h-8 bg-white/85 rounded-full blur-[2px] animate-cloud-slow" />
                            <div className="absolute top-12 left-0 w-32 h-10 bg-white/80 rounded-full blur-[3px] animate-cloud-fast" style={{ animationDelay: '-10s' }} />
                            <div className="absolute top-8 left-0 w-28 h-9 bg-white/75 rounded-full blur-[1px] animate-cloud-slow" style={{ animationDelay: '-25s' }} />
                        </div>

                        {/* Seaside Beach View Underneath */}
                        <div className="absolute inset-x-0 bottom-0 h-52 pointer-events-none z-0 flex flex-col justify-end">
                            {/* Ocean */}
                            <div className="h-16 relative bg-gradient-to-b from-[#0284c7] to-[#0ea5e9] border-b border-[#38bdf8]/35 overflow-hidden">
                                <svg className="absolute inset-x-0 bottom-0 w-full h-8 text-sky-300/35 fill-current" viewBox="0 0 1200 120" preserveAspectRatio="none">
                                    <path d="M0,60 C150,100 350,20 500,60 C650,100 850,20 1000,60 C1150,100 1300,60 1400,60 L1400,120 L0,120 Z" className="animate-pulse" style={{ animationDuration: '5s' }} />
                                    <path d="M0,75 C180,110 310,35 480,75 C650,110 810,35 980,75 C1150,110 1280,75 1400,75 L1400,120 L0,120 Z" className="animate-pulse opacity-40" style={{ animationDuration: '7s', animationDelay: '1.5s' }} />
                                </svg>
                            </div>
                            
                            {/* Sandy Beach */}
                            <div className="h-16 bg-gradient-to-b from-[#fef08a] to-[#fde047] relative border-b border-amber-300/25">
                                <div className="absolute top-1 left-24 text-lg opacity-40">⛱️</div>
                                <div className="absolute top-3 right-32 text-base opacity-35">🐚</div>
                                <div className="absolute top-2 left-1/3 text-lg opacity-40">⛱️</div>
                                <div className="absolute top-4 right-16 text-lg opacity-40">🌴</div>
                            </div>

                            {/* Avenida Beira-Mar (Pista/Coastal Road) */}
                            <div className="h-20 bg-slate-700 relative flex flex-col justify-between border-t-2 border-slate-600 shadow-inner">
                                {/* Sidewalk near beach (Calçada) */}
                                <div className="h-3 bg-slate-300 border-b border-slate-400 flex items-center justify-around">
                                    {Array.from({ length: 15 }).map((_, i) => (
                                        <div key={i} className="w-0.5 h-full bg-slate-400/50" />
                                    ))}
                                </div>
                                
                                {/* Road lane markers (Faixa amarela tracejada no asfalto) */}
                                <div className="flex justify-center items-center h-1 my-auto">
                                    <div className="w-full flex justify-between px-2">
                                        {Array.from({ length: 12 }).map((_, i) => (
                                            <div key={i} className="w-8 h-1 bg-yellow-400 opacity-80" />
                                        ))}
                                    </div>
                                </div>

                                {/* Sidewalk near building (Calçada do Hotel) */}
                                <div className="h-3 bg-slate-400 border-t border-slate-500 flex items-center justify-around">
                                    {Array.from({ length: 15 }).map((_, i) => (
                                        <div key={i} className="w-0.5 h-full bg-slate-500/30" />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Floating Balloons for declined invites */}
                        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-[250] flex flex-col gap-2 pointer-events-none w-full max-w-xs px-4">
                            {floatingBalloons.map((balloon) => (
                                <div 
                                    key={balloon.id} 
                                    className="bg-slate-900/90 backdrop-blur-md border border-red-500/30 text-white rounded-2xl p-3 text-[10px] font-semibold shadow-2xl flex items-start gap-2.5 pointer-events-auto animate-bounce relative"
                                >
                                    <span className="text-base leading-none">🎈</span>
                                    <div className="text-left flex-1 space-y-0.5">
                                        <span className="block font-bold text-red-400">{balloon.recipientNome} recusou o convite:</span>
                                        <span className="block text-slate-200 leading-normal font-medium italic">"{balloon.reason}"</span>
                                    </div>
                                    <button 
                                        type="button"
                                        onClick={() => setFloatingBalloons((prev) => prev.filter(b => b.id !== balloon.id))}
                                        className="text-slate-400 hover:text-white transition-colors"
                                    >
                                        <X size={10} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Indicador do Quarto no Topo */}
                        <div className="z-30 flex items-center justify-between pointer-events-none">
                            <div className="flex items-center gap-2.5 bg-white/75 backdrop-blur-md border border-white/45 rounded-2xl px-4 py-2 shadow-sm text-slate-800 pointer-events-auto">
                                <div className="rounded-lg bg-hotel-blue/10 p-1 text-hotel-blue">
                                    <CurrentRoomIcon size={16} />
                                </div>
                                <div className="text-left">
                                    <span className="block text-[10px] font-extrabold text-hotel-blue/80 uppercase tracking-wider">Sala Ativa</span>
                                    <span className="block text-xs font-black text-slate-850 leading-none mt-0.5">{currentRoom}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 pointer-events-auto">
                                <div className="flex items-center gap-1.5 bg-white/75 backdrop-blur-md border border-white/45 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
                                    <Users size={12} className="text-emerald-600" />
                                    <span>{visiblePlayers.length} Boneco(s)</span>
                                </div>
                                {canDecorate && (
                                    <button
                                        type="button"
                                        onClick={() => setIsDecorating(prev => !prev)}
                                        className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-all shadow-sm ${
                                            isDecorating 
                                                ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' 
                                                : 'bg-white/75 border-white/45 text-slate-700 hover:bg-white/90'
                                        }`}
                                    >
                                        <Wrench size={12} className={isDecorating ? "animate-spin" : ""} />
                                        <span>{isDecorating ? 'Sair do Modo Decorar' : 'Decorar Sala'}</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* RENDERIZADOR ISOMÉTRICO DO MAPA */}
                        <div 
                            className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-visible select-none z-10"
                            style={{
                                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
                                transition: isDragging ? 'none' : 'transform 0.15s ease-out'
                            }}
                        >
                            <div className="relative w-[480px] h-[360px]">
                                
                                {/* Base de concreto 3D e Fachada do Prédio */}
                                <BuildingBaseSvg />

                                {/* Paredes Isométricas 3D de Fundo */}
                                <WallSvg room={currentRoom} customWallColor={roomLayout?.wallColor} />

                                {/* Renderizar os Tiles do Chão */}
                                {Array.from({ length: BOARD_SIZE }).map((_, x) =>
                                    Array.from({ length: BOARD_SIZE }).map((_, y) => {
                                        const pos = getIsometricPos(x, y);
                                        const isMyTarget = myPosition.x === x && myPosition.y === y;
                                        const isObstacle = roomObstacles.has(`${x},${y}`);
                                        const isPortal = x === 4 && y === 0;

                                        let tileColor = 'rgba(255,255,255,0.06)';
                                        
                                        // Base floor patterns
                                        if (roomLayout?.floorPattern === 'parquet') {
                                            tileColor = (x + y) % 2 === 0 ? 'rgba(146, 64, 14, 0.7)' : 'rgba(120, 53, 4, 0.7)';
                                        } else if (roomLayout?.floorPattern === 'marble') {
                                            tileColor = (x + y) % 2 === 0 ? 'rgba(241, 245, 249, 0.75)' : 'rgba(226, 232, 240, 0.75)';
                                        } else if (roomLayout?.floorPattern === 'checkered') {
                                            tileColor = (x + y) % 2 === 0 ? 'rgba(248, 250, 252, 0.85)' : 'rgba(30, 41, 59, 0.85)';
                                        }

                                        // Overlay selections
                                        if (isMyTarget) {
                                            tileColor = 'rgba(212,175,55,0.85)';
                                        } else if (isPortal) {
                                            tileColor = 'rgba(14,165,233,0.5)';
                                        }

                                        return (
                                            <div
                                                key={`${x}-${y}`}
                                                onClick={() => handleTileClick(x, y)}
                                                className={`absolute w-[80px] h-[40px] pointer-events-auto cursor-pointer transition-all duration-150 ${
                                                    isDecorating ? 'hover:brightness-110' : ''
                                                }`}
                                                style={{
                                                    left: pos.left,
                                                    top: pos.top,
                                                }}
                                                title={`Bloco (${x}, ${y})`}
                                            >
                                                <svg width="80" height="40" viewBox="0 0 80 40" className="overflow-visible" shapeRendering="crispEdges">
                                                    <polygon 
                                                        points="40,0 80,20 40,40 0,20" 
                                                        fill={tileColor} 
                                                        stroke={isPortal ? "#00d2ff" : "#000000"} 
                                                        strokeWidth={isPortal || isMyTarget ? 2 : 1} 
                                                    />
                                                </svg>
                                            </div>
                                        );
                                    })
                                )}

                                {/* RENDERIZAÇÃO ORDENADA POR DEPÓSITO VISUAL (DEPTH SORTING) */}
                                {sortedEntities.map((item) => {
                                    const pos = getIsometricPos(item.x, item.y);
                                    
                                    if (item.type === 'furniture') {
                                        const isDeskGlow = isDeskActive(item.x, item.y, visiblePlayers, roomLayout?.furniture);
                                        const isEditingThis = editingFurniture && editingFurniture.x === item.x && editingFurniture.y === item.y;
                                        return (
                                            <div 
                                                key={item.id}
                                                className={`absolute w-[80px] h-[80px] pointer-events-auto transition-transform ${
                                                    isDecorating 
                                                        ? `hover:scale-[1.03] cursor-pointer ${isEditingThis ? 'ring-2 ring-emerald-500 rounded-2xl bg-emerald-500/10' : ''}` 
                                                        : (item.furnType === 'director_desk' || item.furnType === 'tool_bench' ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-default')
                                                }`}
                                                style={{
                                                    left: pos.left,
                                                    top: pos.top - 40,
                                                    zIndex: 10 + item.y + item.x
                                                }}
                                                title={
                                                    isDecorating 
                                                        ? `Clique para editar ou girar ${item.furnType}`
                                                        : (item.furnType === 'director_desk' ? 'Mesa Executiva (Clique para Painel de Aprovações)' :
                                                           item.furnType === 'tool_bench' ? 'Caixa de Ferramentas (Clique para Criar Nova SI)' :
                                                           'Mobiliário')
                                                }
                                                onClick={(e) => {
                                                    if (isDecorating) {
                                                        e.stopPropagation();
                                                        handleTileClick(item.x, item.y);
                                                    } else {
                                                        if (item.furnType === 'director_desk') {
                                                            navigate('/aprovacoes');
                                                        } else if (item.furnType === 'tool_bench') {
                                                            navigate('/nova-os');
                                                        }
                                                    }
                                                }}
                                            >
                                                <div 
                                                    style={{ 
                                                        transform: `scaleX(${(item.rotation === 90 || item.rotation === 270) ? -1 : 1})`,
                                                        filter: (item.rotation === 180 || item.rotation === 270) ? 'brightness(0.86)' : 'none',
                                                        transformOrigin: 'center',
                                                        transition: 'transform 0.2s ease-out, filter 0.2s ease-out'
                                                    }}
                                                    className="w-full h-full flex items-center justify-center"
                                                >
                                                    <FurnitureSvg type={item.furnType} isGlow={isDeskGlow} />
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (item.type === 'portal') {
                                        const isElevatorOpen = visiblePlayers.some(p => Math.abs(p.x - 4) <= 1 && Math.abs(p.y - 0) <= 1);
                                        return (
                                            <div 
                                                key={item.id}
                                                className="absolute w-[80px] h-[80px] pointer-events-auto group relative cursor-pointer"
                                                style={{
                                                    left: pos.left,
                                                    top: pos.top - 40,
                                                    zIndex: 10 + item.y + item.x
                                                }}
                                                onClick={() => {
                                                    if (myPosition.x === 4 && myPosition.y === 0) {
                                                        setShowTravelMap(true);
                                                    } else {
                                                        handleTileClick(4, 0);
                                                    }
                                                }}
                                            >
                                                {/* Floating Label above elevator */}
                                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-indigo-600 border border-blue-400/30 text-white text-[8px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap pointer-events-none select-none z-[120] shadow-md shadow-blue-500/20">
                                                    Elevador Central
                                                </div>

                                                <FurnitureSvg 
                                                    type="elevator" 
                                                    isOpen={isElevatorOpen} 
                                                    displayFloor={getFloorAbbreviation(currentRoom)} 
                                                />
                                                
                                                {/* Tooltip on Hover */}
                                                <div className="absolute top-[80px] left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700/50 text-slate-100 text-[10px] px-2.5 py-1.5 rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 whitespace-nowrap pointer-events-none select-none z-[130] w-max text-center leading-normal">
                                                    <span className="block font-bold text-hotel-gold text-[10px] mb-0.5">Viagem Rápida</span>
                                                    Use o elevador para viajar instantaneamente entre os 17 setores do hotel.
                                                </div>
                                            </div>
                                        );
                                    }

                                    if (item.type === 'player') {
                                        const showMsg = item.playerData.message && item.playerData.messageTime && 
                                            (new Date() - new Date(item.playerData.messageTime)) < 6000;
                                        
                                        const isSitting = isPlayerSittingOnChair(item.x, item.y, roomLayout?.furniture);
                                        const isWorking = isSitting && hasDeskAdjacent(item.x, item.y, roomLayout?.furniture);

                                        return (
                                            <div
                                                key={item.id}
                                                className={`absolute w-12 h-12 transition-all duration-200 ${
                                                    item.isMe ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer hover:scale-[1.08] hover:brightness-110'
                                                }`}
                                                onClick={item.isMe ? undefined : (e) => {
                                                    e.stopPropagation();
                                                    handlePlayerClick(item.playerData);
                                                }}
                                                style={{
                                                    left: pos.left + 16,
                                                    top: pos.top - 32,
                                                    zIndex: 10 + item.y + item.x + 1, // Render player in front of furniture on the same tile
                                                    transition: 'left 220ms linear, top 220ms linear' // Smooth walking animation
                                                }}
                                            >
                                                {/* Balão de Fala do Habbo */}
                                                {showMsg && (
                                                    <div 
                                                        className="absolute bottom-[48px] left-1/2 -translate-x-1/2 bg-white text-slate-800 border border-slate-200 px-3 py-1.5 rounded-2xl text-[10px] font-bold shadow-xl whitespace-nowrap z-[210] flex items-center gap-1 select-none animate-bounce"
                                                    >
                                                        <span className="text-slate-400 text-[9px] font-medium">{item.playerData.nome}:</span>
                                                        <span>{item.playerData.message}</span>
                                                        <div className="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2 h-2 bg-white border-r border-b border-slate-200 rotate-45" />
                                                    </div>
                                                )}

                                                {/* Balão de Status Trabalhando */}
                                                {!showMsg && isWorking && (
                                                    <div 
                                                        className="absolute bottom-[48px] left-1/2 -translate-x-1/2 bg-slate-900/90 text-emerald-400 border border-emerald-500/30 px-2 py-1 rounded-xl text-[9px] font-semibold shadow-lg whitespace-nowrap z-[210] flex items-center gap-1 select-none opacity-90"
                                                    >
                                                        <span className="animate-pulse">💻 Trabalhando...</span>
                                                        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-slate-900 border-r border-b border-emerald-500/30 rotate-45" />
                                                    </div>
                                                )}

                                                {/* Desenho do Avatar */}
                                                <AvatarSvg 
                                                    style={item.playerData.avatarStyle} 
                                                    size={48} 
                                                    isWalking={item.isMe ? isWalking : false}
                                                    isSitting={isSitting}
                                                    isWorking={isWorking}
                                                    showMsg={showMsg}
                                                />

                                                {/* Nome flutuante */}
                                                <span 
                                                    className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold px-1.5 py-0.5 rounded border leading-none whitespace-nowrap shadow-sm select-none ${
                                                        item.isMe
                                                            ? 'bg-hotel-gold border-hotel-gold/30 text-white'
                                                            : 'bg-slate-900/80 border-slate-700 text-slate-100'
                                                    }`}
                                                >
                                                    {item.isMe ? 'Eu' : item.playerData.nome}
                                                    {isWorking && ' 💻'}
                                                </span>
                                            </div>
                                        );
                                    }

                                    return null;
                                })}

                                {/* POPUP DE EDIÇÃO DE MOBÍLIA (ROTAÇÃO E REMOÇÃO DE ACORDO COM O SELECIONADO) */}
                                {isDecorating && editingFurniture && (
                                    (() => {
                                        const pos = getIsometricPos(editingFurniture.x, editingFurniture.y);
                                        return (
                                            <div 
                                                className="absolute z-[250] pointer-events-auto bg-slate-900/95 backdrop-blur-md border border-slate-700/60 rounded-2xl p-2.5 shadow-2xl flex items-center gap-1.5 whitespace-nowrap"
                                                style={{
                                                    left: pos.left + 40,
                                                    top: pos.top - 80,
                                                    transform: 'translate(-50%, -50%)',
                                                    transition: 'left 0.15s ease-out, top 0.15s ease-out'
                                                }}
                                            >
                                                {/* Arrow pointing down */}
                                                <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900/95 border-r border-b border-slate-700/60 rotate-45 pointer-events-none" />
                                                
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRotateFurniture(90);
                                                    }}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-[10px] font-extrabold rounded-lg text-white"
                                                >
                                                    🔄 Girar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRemoveFurniture();
                                                    }}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all text-[10px] font-extrabold rounded-lg text-white"
                                                >
                                                    ❌ Remover
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setEditingFurniture(null);
                                                    }}
                                                    className="flex items-center justify-center p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                                                    title="Fechar"
                                                >
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        );
                                    })()
                                )}

                            </div>
                        </div>

                        {/* Barra de Chat do Habbo */}
                        <div className="z-30 w-full mt-auto">
                            <form onSubmit={handleChatSubmit} className="flex gap-2 font-body">
                                <input
                                    type="text"
                                    placeholder="Diga algo na sala..."
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    maxLength={80}
                                    className="flex-1 rounded-2xl bg-white/80 border border-white/45 px-4 py-3 text-xs text-slate-800 placeholder-slate-400 outline-none focus:border-hotel-gold focus:ring-1 focus:ring-hotel-gold/30 transition-colors backdrop-blur-md shadow-sm"
                                />
                                <button
                                    type="submit"
                                    className="rounded-2xl bg-hotel-gold px-5 py-3 text-xs font-bold text-white hover:bg-hotel-gold-lt active:scale-95 transition-all shadow-md shadow-hotel-gold/15"
                                >
                                    Falar
                                </button>
                            </form>
                        </div>

                    </div>

                    {/* Barra de Informações Lateral */}
                    <div className="space-y-4">
                        {isDecorating ? (
                            /* Painel do Modo Decorar (Catálogo) */
                            <div className="rounded-3xl border border-slate-150 bg-white p-5 shadow-sm space-y-6 animate-fadeIn">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="rounded-lg bg-emerald-100 p-2 text-emerald-600">
                                            <Wrench size={16} />
                                        </div>
                                        <h3 className="font-heading text-xs font-extrabold uppercase tracking-wider text-slate-700">
                                            Painel de Decoração
                                        </h3>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsDecorating(false)}
                                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 transition-all"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* 1. Escolha da Cor da Parede */}
                                <div className="space-y-2">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cores de Parede</span>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { name: 'Padrão', value: '' },
                                            { name: 'Azul', value: '#1e3a8a' },
                                            { name: 'Vermelho', value: '#7f1d1d' },
                                            { name: 'Verde', value: '#064e3b' },
                                            { name: 'Roxo', value: '#3b0764' },
                                            { name: 'Rosa', value: '#500724' },
                                            { name: 'Cinza', value: '#334155' }
                                        ].map((color) => (
                                            <button
                                                key={color.name}
                                                type="button"
                                                onClick={() => {
                                                    const updated = {
                                                        ...roomLayout,
                                                        wallColor: color.value
                                                    };
                                                    setRoomLayout(updated);
                                                    updateRoomLayout(currentRoom, updated).catch(() => {});
                                                    addNotification(`Cor da parede atualizada para ${color.name}!`, 'info');
                                                }}
                                                className={`h-7 px-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                                                    roomLayout?.wallColor === color.value 
                                                        ? 'ring-2 ring-hotel-gold border-white scale-105 bg-slate-900 text-white' 
                                                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                                }`}
                                                style={color.value ? { borderLeft: `4px solid ${color.value}` } : {}}
                                            >
                                                {color.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 2. Escolha do Padrão do Piso */}
                                <div className="space-y-2">
                                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Textura do Piso</span>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { id: 'standard', name: 'Carpete Escuro' },
                                            { id: 'parquet', name: 'Parquet de Madeira' },
                                            { id: 'marble', name: 'Mármore Fino' },
                                            { id: 'checkered', name: 'Quadriculado' }
                                        ].map((pattern) => (
                                            <button
                                                key={pattern.id}
                                                type="button"
                                                onClick={() => {
                                                    const updated = {
                                                        ...roomLayout,
                                                        floorPattern: pattern.id
                                                    };
                                                    setRoomLayout(updated);
                                                    updateRoomLayout(currentRoom, updated).catch(() => {});
                                                    addNotification(`Piso atualizado para ${pattern.name}!`, 'info');
                                                }}
                                                className={`py-2 px-2.5 rounded-xl border text-[10px] font-bold text-center transition-all ${
                                                    roomLayout?.floorPattern === pattern.id 
                                                        ? 'bg-slate-900 border-slate-900 text-white shadow-sm' 
                                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            {pattern.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 3. Escolha de Mobília (Móveis) */}
                            <div className="space-y-2">
                                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Catálogo de Mobília</span>
                                <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1">
                                    {[
                                        { id: 'office_chair', name: 'Cadeira Office' },
                                        { id: 'office_desk', name: 'Mesa Office' },
                                        { id: 'director_desk', name: 'Mesa Executiva' },
                                        { id: 'meeting_table', name: 'Mesa Reuniões' },
                                        { id: 'monstera_plant', name: 'Vaso Monstera' },
                                        { id: 'bonsai_tree', name: 'Mini Bonsai' },
                                        { id: 'coffee_machine', name: 'Cafeteira' },
                                        { id: 'whiteboard', name: 'Quadro Branco' },
                                        { id: 'rug_red', name: 'Tapete Vermelho' },
                                        { id: 'rug_blue', name: 'Tapete Azul' },
                                        { id: 'leather_sofa', name: 'Sofá de Couro' },
                                        { id: 'cleaning_cart', name: 'Carrinho Operador' },
                                        { id: 'tool_bench', name: 'Bancada SIs' },
                                        { id: 'server_rack', name: 'Servidor TI' },
                                        { id: 'industrial_washer', name: 'Máquina Lavanderia' },
                                        { id: 'flower_vase', name: 'Vaso de Flores' },
                                        { id: 'floor_lamp', name: 'Luminária de Chão' },
                                        { id: 'bookshelf', name: 'Estante de Livros' },
                                        { id: 'water_dispenser', name: 'Bebedouro' },
                                        { id: 'minibar', name: 'Frigobar' }
                                    ].map((item) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelectedCatalogItem(item.id)}
                                            className={`p-2.5 rounded-xl border text-[10px] font-bold text-left transition-all ${
                                                selectedCatalogItem === item.id 
                                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 font-extrabold ring-1 ring-emerald-500/30' 
                                                    : 'bg-white border-slate-150 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {item.name}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[10px] text-slate-400 leading-normal mt-2">
                                    💡 <strong>Como usar:</strong> Selecione um item acima e clique em qualquer bloco vazio do quarto para colocá-lo. Clique em um móvel existente para removê-lo.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Card do Setor Detalhes */}
                            <div className="rounded-3xl border border-slate-150 bg-white p-5 shadow-sm space-y-4">
                                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                                    <div className="rounded-lg bg-hotel-blue/15 p-2 text-hotel-blue">
                                        <CurrentRoomIcon size={16} />
                                    </div>
                                    <h3 className="font-heading text-xs font-extrabold uppercase tracking-wider text-slate-700">
                                        {currentRoom}
                                    </h3>
                                </div>
                                
                                <div className="space-y-3 text-xs text-slate-650 leading-relaxed font-body">
                                    <p>{ROOMS_CONFIG[currentRoom]?.description}</p>
                                    <div className="rounded-2xl bg-slate-50 border border-slate-150 p-4 space-y-1.5">
                                        <span className="block text-[9px] font-extrabold text-hotel-gold uppercase tracking-wider">Instruções</span>
                                        <p className="text-[11px] leading-relaxed text-slate-500">
                                            {ROOMS_CONFIG[currentRoom]?.tips}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Integração Física de Ações */}
                            <div className="rounded-3xl border border-slate-150 bg-white p-5 shadow-sm space-y-3">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-heading">
                                    <MapPin size={12} className="text-hotel-gold" /> Ações Rápidas
                                </h4>
                                
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigate('/nova-os');
                                            addNotification('Criar SI rápida selecionada.', 'info');
                                        }}
                                        className="w-full text-left inline-flex items-center justify-between rounded-xl border border-slate-150 p-3 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-350 transition-all"
                                    >
                                        <span>Criar Nova Ordem (SI)</span>
                                        <ChevronRight size={14} className="text-slate-400" />
                                    </button>
                                    {profile?.role === 'DIRETORA' || profile?.role === 'ADMIN' ? (
                                        <button
                                            type="button"
                                            onClick={() => navigate('/aprovacoes')}
                                            className="w-full text-left inline-flex items-center justify-between rounded-xl border border-slate-150 p-3 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-350 transition-all"
                                        >
                                            <span>Painel de Aprovação SI</span>
                                            <ChevronRight size={14} className="text-slate-400" />
                                        </button>
                                    ) : null}
                                </div>
                            </div>

                            {/* Diretório de Líderes e Equipe */}
                            <div className="rounded-3xl border border-slate-150 bg-white p-5 shadow-sm space-y-4 animate-fadeIn">
                                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-heading">
                                    <Users size={12} className="text-hotel-blue" /> Líderes e Diretoria
                                </h4>
                                
                                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                    {hotelStaff.length === 0 ? (
                                        <p className="text-[11px] text-slate-400 font-medium py-2 text-center">Nenhum funcionário cadastrado.</p>
                                    ) : (
                                        hotelStaff.map((u) => {
                                            const onlinePlayer = players.find(p => p.id === u.id);
                                            const activeRoom = onlinePlayer?.room;
                                            
                                            return (
                                                <div
                                                    key={u.id}
                                                    onClick={() => handlePlayerClick({
                                                        id: u.id,
                                                        nome: u.nome,
                                                        room: activeRoom || null,
                                                        avatarStyle: onlinePlayer?.avatarStyle || null
                                                    })}
                                                    className="group flex items-center justify-between p-2 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 cursor-pointer transition-all"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="relative flex-shrink-0">
                                                            <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-[11px] font-extrabold uppercase select-none">
                                                                {u.nome?.charAt(0).toUpperCase()}
                                                            </div>
                                                            <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white ${
                                                                activeRoom ? 'bg-emerald-500 animate-pulse' : 'bg-slate-350'
                                                            }`} />
                                                        </div>
                                                        <div className="text-left min-w-0">
                                                            <span className="block text-[11px] font-extrabold text-slate-800 truncate leading-tight group-hover:text-hotel-blue transition-colors">
                                                                {u.nome}
                                                            </span>
                                                            <span className="block text-[9px] font-bold text-slate-400 leading-none mt-0.5">
                                                                {u.role === 'DIRETORA' ? 'Diretora' : u.departamentos?.join(', ') || 'Sem setor'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="text-right flex-shrink-0">
                                                        {activeRoom ? (
                                                            <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                                                {activeRoom}
                                                            </span>
                                                        ) : (
                                                            <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wide">
                                                                Ausente
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
                </div>

            </div>

            {/* MODAL DE VIAGEM PELO HOTEL (SELEÇÃO DE QUARTO COMPLETA) */}
            {showTravelMap && (
                <div className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl border border-slate-100 flex flex-col space-y-5 animate-scaleUp">
                        
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl bg-hotel-blue/15 p-2 text-hotel-blue">
                                    <ConciergeBell size={20} />
                                </div>
                                <div>
                                    <h3 className="font-heading text-base font-bold text-slate-800">
                                        Elevador do Hotel: Selecionar Quarto
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Escolha para qual departamento do hotel você deseja viajar.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowTravelMap(false)}
                                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Grid dos 17 setores do hotel */}
                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 max-h-[350px] overflow-y-auto pr-1 py-1">
                            {Object.keys(ROOMS_CONFIG).map((roomName) => {
                                const RIcon = ROOMS_CONFIG[roomName].icon;
                                const isCurrent = roomName === currentRoom;
                                
                                return (
                                    <button
                                        key={roomName}
                                        type="button"
                                        onClick={() => handleRoomChange(roomName)}
                                        className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all ${
                                            isCurrent
                                                ? 'bg-hotel-blue border-hotel-blue text-white shadow-md'
                                                : 'bg-slate-50 border-slate-150 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className={`p-2 rounded-xl mb-2 ${isCurrent ? 'bg-white/10 text-white' : 'bg-white text-slate-600 border border-slate-150'}`}>
                                            <RIcon size={18} />
                                        </div>
                                        <span className="text-[11px] font-bold tracking-tight line-clamp-1">{roomName}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE CUSTOMIZAÇÃO DE AVATAR PREMIUM */}
            {showCustomizer && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-xl rounded-[32px] bg-white p-6 shadow-2xl border border-slate-100 flex flex-col space-y-5 animate-scaleUp">
                        
                        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl bg-hotel-gold/15 p-2 text-hotel-gold">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <h3 className="font-heading text-base font-bold text-slate-800">
                                        Customizar Meu Avatar
                                    </h3>
                                    <p className="text-xs text-slate-400 mt-0.5">Defina o gênero, estilo de cabelo, roupas e cores do seu boneco.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCustomizer(false)}
                                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Corpo da customização */}
                        <div className="grid gap-6 sm:grid-cols-[140px_1fr] items-center">
                            
                            {/* Preview Lateral do Avatar */}
                            <div className="flex flex-col items-center justify-center border border-slate-100 rounded-3xl p-4 bg-slate-50/50">
                                <AvatarSvg style={avatarStyle} size={100} />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-3">Visualização</span>
                            </div>

                            {/* Controles de Configurações */}
                            <div className="space-y-4 max-h-[320px] overflow-y-auto pr-1">
                                
                                {/* Seleção de Gênero */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gênero do Boneco</label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setAvatarStyle((prev) => ({ 
                                                ...prev, 
                                                gender: 'masculino',
                                                hairStyle: 'short',
                                                shirtStyle: 'tshirt'
                                            }))}
                                            className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                                                avatarStyle.gender === 'masculino' 
                                                    ? 'bg-hotel-blue border-hotel-blue text-white shadow-sm'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            Masculino
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setAvatarStyle((prev) => ({ 
                                                ...prev, 
                                                gender: 'feminino',
                                                hairStyle: 'straight',
                                                shirtStyle: 'dress'
                                            }))}
                                            className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${
                                                avatarStyle.gender === 'feminino' 
                                                    ? 'bg-hotel-blue border-hotel-blue text-white shadow-sm'
                                                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                            }`}
                                        >
                                            Feminino
                                        </button>
                                    </div>
                                </div>

                                {/* Tom de Pele */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cor da Pele</label>
                                    <div className="flex gap-2">
                                        {['#FDBA74', '#FCD34D', '#FCA5A5', '#c39b76', '#855845'].map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setAvatarStyle((prev) => ({ ...prev, skinColor: color }))}
                                                className={`w-6 h-6 rounded-full border transition-all ${
                                                    avatarStyle.skinColor === color ? 'ring-2 ring-hotel-gold border-white scale-110' : 'border-slate-200'
                                                }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Tipo de Cabelo */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Estilo de Cabelo</label>
                                    <select
                                        value={avatarStyle.hairStyle}
                                        onChange={(e) => setAvatarStyle((prev) => ({ ...prev, hairStyle: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none cursor-pointer focus:border-hotel-gold"
                                    >
                                        {avatarStyle.gender === 'masculino' ? (
                                            <>
                                                <option value="short">Short Clássico</option>
                                                <option value="spiky">Moicano / Espetado</option>
                                                <option value="pompadour">Topete Pompadour</option>
                                                <option value="dreads">Dreadlocks</option>
                                                <option value="cap">Boné de Lado</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="straight">Liso Longo</option>
                                                <option value="ponytail">Rabo de Cavalo</option>
                                                <option value="braids">Tranças Duplas</option>
                                                <option value="bob">Chanel com Tiara</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                {/* Cor do Cabelo */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cor do Cabelo</label>
                                    <div className="flex gap-2">
                                        {['#1e293b', '#475569', '#b45309', '#f59e0b', '#ec4899'].map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setAvatarStyle((prev) => ({ ...prev, hairColor: color }))}
                                                className={`w-6 h-6 rounded-full border transition-all ${
                                                    avatarStyle.hairColor === color ? 'ring-2 ring-hotel-gold border-white scale-110' : 'border-slate-200'
                                                }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Estilo de Camisa */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Estilo da Roupa</label>
                                    <select
                                        value={avatarStyle.shirtStyle}
                                        onChange={(e) => setAvatarStyle((prev) => ({ ...prev, shirtStyle: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none cursor-pointer focus:border-hotel-gold"
                                    >
                                        {avatarStyle.gender === 'masculino' ? (
                                            <>
                                                <option value="hf-suit">Terno Premium HF (HotelFlow)</option>
                                                <option value="tshirt">Camiseta Manga Curta</option>
                                                <option value="hoodie">Moletom Canguru</option>
                                                <option value="suit">Terno e Gravata</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="hf-suit">Terno Premium HF (HotelFlow)</option>
                                                <option value="dress">Vestido de Verão</option>
                                                <option value="jacket">Blazer Social</option>
                                                <option value="crop-top">Crop-top Casual</option>
                                            </>
                                        )}
                                    </select>
                                </div>

                                {/* Cor da Camisa */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cor da Roupa</label>
                                    <div className="flex gap-2">
                                        {['#0A3D62', '#b91c1c', '#047857', '#6d28d9', '#f43f5e', '#0f172a'].map((color) => (
                                            <button
                                                key={color}
                                                type="button"
                                                onClick={() => setAvatarStyle((prev) => ({ ...prev, shirtColor: color }))}
                                                className={`w-6 h-6 rounded-full border transition-all ${
                                                    avatarStyle.shirtColor === color ? 'ring-2 ring-hotel-gold border-white scale-110' : 'border-slate-200'
                                                }`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Cor da Calça (se houver) */}
                                {avatarStyle.shirtStyle !== 'dress' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cor da Calça/Saia</label>
                                        <div className="flex gap-2">
                                            {['#1E293B', '#3b82f6', '#ffffff', '#475569', '#d97706'].map((color) => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setAvatarStyle((prev) => ({ ...prev, pantsColor: color }))}
                                                    className={`w-6 h-6 rounded-full border transition-all ${
                                                        avatarStyle.pantsColor === color ? 'ring-2 ring-hotel-gold border-white scale-110' : 'border-slate-200'
                                                    }`}
                                                    style={{ backgroundColor: color }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Acessórios */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Acessório</label>
                                    <select
                                        value={avatarStyle.accessory}
                                        onChange={(e) => setAvatarStyle((prev) => ({ ...prev, accessory: e.target.value }))}
                                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none cursor-pointer focus:border-hotel-gold"
                                    >
                                        <option value="none">Nenhum</option>
                                        <option value="headset">Headset de Escritório</option>
                                        <option value="glasses">Óculos Escuros</option>
                                        <option value="nerd-glasses">Óculos de Grau</option>
                                        <option value="crown">Coroa de Ouro</option>
                                        <option value="bow">Laço de Cabelo (Feminino)</option>
                                        <option value="scarf">Cachecol Vermelho</option>
                                        <option value="mask">Máscara de Proteção</option>
                                        <option value="mustache">Bigode Clássico</option>
                                    </select>
                                </div>

                            </div>
                        </div>

                        {/* Botões do Rodapé */}
                        <div className="flex gap-3 pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => handleSaveAvatar(avatarStyle)}
                                className="flex-1 rounded-xl bg-hotel-blue py-3 text-xs font-bold text-white transition-all hover:bg-hotel-blue-md active:scale-95 shadow-md shadow-hotel-blue/15"
                            >
                                Salvar Estilo
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowCustomizer(false)}
                                className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 transition-all hover:bg-slate-50 active:scale-95"
                            >
                                Cancelar
                            </button>
                        </div>

                    </div>
                </div>
            )}

            {/* MODAL DE INTERAÇÃO RÁPIDA (HABBO STYLE ACTIONS) */}
            {interactionMenuOpen && selectedInteractionPlayer && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-sm rounded-[32px] bg-white p-6 shadow-2xl border border-slate-100 flex flex-col space-y-5 animate-scaleUp text-left">
                        
                        {/* Botão de Fechar no Topo */}
                        <button
                            type="button"
                            onClick={() => setInteractionMenuOpen(false)}
                            className="absolute top-4 right-4 rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-all"
                        >
                            <X size={18} />
                        </button>

                        {/* Informações do Perfil */}
                        <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
                            <div className="relative">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-hotel-blue to-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-lg shadow-hotel-blue/20">
                                    {selectedInteractionPlayer.nome?.charAt(0).toUpperCase()}
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                                    selectedInteractionPlayer.room ? 'bg-emerald-500' : 'bg-slate-300'
                                }`} />
                            </div>
                            <div>
                                <h3 className="font-heading text-base font-extrabold text-slate-800 leading-tight">
                                    {selectedInteractionPlayer.nome}
                                </h3>
                                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-[9px] font-extrabold text-slate-500 uppercase tracking-wider">
                                        {users.find(u => u.id === selectedInteractionPlayer.id)?.role || 'Funcionário'}
                                    </span>
                                    <span className={`text-[10px] font-bold ${
                                        selectedInteractionPlayer.room ? 'text-emerald-500' : 'text-slate-400'
                                    }`}>
                                        {selectedInteractionPlayer.room 
                                            ? `Ativo em ${selectedInteractionPlayer.room}` 
                                            : 'Ausente do Mundo'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Opções de Ação */}
                        <div className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={openSiForm}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-150 bg-slate-50/50 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all text-xs font-bold text-slate-700 active:scale-98"
                            >
                                <span className="flex items-center gap-2.5">
                                    <Wrench size={14} className="text-hotel-gold" />
                                    <span>Criar SI para {selectedInteractionPlayer.nome}</span>
                                </span>
                                <ChevronRight size={14} className="opacity-50" />
                            </button>

                            <button
                                type="button"
                                onClick={openFinalizeForm}
                                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-150 bg-slate-50/50 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all text-xs font-bold text-slate-700 active:scale-98"
                            >
                                <span className="flex items-center gap-2.5">
                                    <Check size={14} className="text-emerald-500" />
                                    <span>Solicitar Finalização de SI</span>
                                </span>
                                <ChevronRight size={14} className="opacity-50" />
                            </button>

                            {selectedInteractionPlayer.room !== currentRoom && (
                                <button
                                    type="button"
                                    onClick={handleInviteToChat}
                                    className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-slate-150 bg-slate-50/50 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all text-xs font-bold text-slate-700 active:scale-98"
                                >
                                    <span className="flex items-center gap-2.5">
                                        <ConciergeBell size={14} className="text-blue-500" />
                                        <span>Chamar para Conversar</span>
                                    </span>
                                    <ChevronRight size={14} className="opacity-50" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL FORMULÁRIO DE NOVA SI IN-GAME */}
            {siFormOpen && selectedInteractionPlayer && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-scaleUp text-left">
                        
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="rounded-xl bg-hotel-gold/15 p-2 text-hotel-gold">
                                    <Wrench size={18} />
                                </div>
                                <div>
                                    <h3 className="font-heading text-sm font-bold text-slate-800">
                                        Nova SI para {selectedInteractionPlayer.nome}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Preencha os dados para criar uma ordem de serviço de verdade.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSiFormOpen(false)}
                                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateSI} className="space-y-3 font-body text-xs text-slate-700">
                            {/* Título */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider" htmlFor="si-title">
                                    Título da SI
                                </label>
                                <input
                                    id="si-title"
                                    type="text"
                                    value={siTitle}
                                    onChange={(e) => setSiTitle(e.target.value)}
                                    placeholder="Ex: Vazamento de água no banheiro"
                                    className={`w-full rounded-2xl border ${
                                        siErrors.titulo ? 'border-red-500 bg-red-50/20' : 'border-slate-200 bg-slate-50/50'
                                    } px-4 py-2.5 outline-none focus:border-hotel-gold focus:bg-white transition-all`}
                                />
                                {siErrors.titulo && (
                                    <span className="text-[9px] font-bold text-red-500">{siErrors.titulo}</span>
                                )}
                            </div>

                            {/* Descrição */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider" htmlFor="si-desc">
                                    Descrição Detalhada
                                </label>
                                <textarea
                                    id="si-desc"
                                    rows={3}
                                    value={siDesc}
                                    onChange={(e) => setSiDesc(e.target.value)}
                                    placeholder="Descreva o que precisa ser feito..."
                                    className={`w-full rounded-2xl border ${
                                        siErrors.descricao ? 'border-red-500 bg-red-50/20' : 'border-slate-200 bg-slate-50/50'
                                    } px-4 py-2.5 outline-none focus:border-hotel-gold focus:bg-white transition-all resize-none`}
                                />
                                {siErrors.descricao && (
                                    <span className="text-[9px] font-bold text-red-500">{siErrors.descricao}</span>
                                )}
                            </div>

                            {/* Departamento */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider" htmlFor="si-dept">
                                    Setor / Departamento
                                </label>
                                <select
                                    id="si-dept"
                                    value={siDept}
                                    onChange={(e) => setSiDept(e.target.value)}
                                    className={`w-full rounded-2xl border ${
                                        siErrors.departamento ? 'border-red-500 bg-red-50/20' : 'border-slate-200 bg-slate-50/50'
                                    } px-4 py-2.5 outline-none focus:border-hotel-gold focus:bg-white transition-all cursor-pointer`}
                                >
                                    <option value="">Selecione o setor responsável</option>
                                    {availableDepartments?.map((d) => (
                                        <option key={d} value={d}>{d}</option>
                                    ))}
                                </select>
                                {siErrors.departamento && (
                                    <span className="text-[9px] font-bold text-red-500">{siErrors.departamento}</span>
                                )}
                            </div>

                            {/* Prazo */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider" htmlFor="si-deadline">
                                    Prazo Limite
                                </label>
                                <input
                                    id="si-deadline"
                                    type="date"
                                    value={siPrazo}
                                    onChange={(e) => setSiPrazo(e.target.value)}
                                    className={`w-full rounded-2xl border ${
                                        siErrors.prazo ? 'border-red-500 bg-red-50/20' : 'border-slate-200 bg-slate-50/50'
                                    } px-4 py-2.5 outline-none focus:border-hotel-gold focus:bg-white transition-all`}
                                />
                                {siErrors.prazo && (
                                    <span className="text-[9px] font-bold text-red-500">{siErrors.prazo}</span>
                                )}
                            </div>

                            {/* Botões */}
                            <div className="flex gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="submit"
                                    disabled={siLoading}
                                    className="flex-1 rounded-2xl bg-hotel-blue py-3 text-xs font-bold text-white transition-all hover:bg-hotel-blue/90 active:scale-95 disabled:opacity-50 shadow-md shadow-hotel-blue/15"
                                >
                                    {siLoading ? 'Gravando...' : 'Criar SI'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSiFormOpen(false)}
                                    className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-650 transition-all hover:bg-slate-50 active:scale-95"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL DE SOLICITAÇÃO DE FINALIZAÇÃO DE SI */}
            {finalizeFormOpen && selectedInteractionPlayer && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="relative w-full max-w-md rounded-[32px] bg-white p-6 shadow-2xl border border-slate-100 flex flex-col space-y-4 animate-scaleUp text-left">
                        
                        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="rounded-xl bg-emerald-100 p-2 text-emerald-600">
                                    <Check size={18} />
                                </div>
                                <div>
                                    <h3 className="font-heading text-sm font-bold text-slate-800">
                                        Solicitar Finalização de SI
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Escolha uma SI criada por {selectedInteractionPlayer.nome} atribuída a você.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFinalizeFormOpen(false)}
                                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* List / Selection */}
                        <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                            {eligibleSIs.length === 0 ? (
                                <div className="rounded-2xl border border-slate-150 bg-slate-50 p-6 text-center text-slate-500 flex flex-col items-center justify-center space-y-2">
                                    <span className="text-xl">📁</span>
                                    <p className="text-xs font-semibold leading-relaxed">
                                        Nenhuma SI em andamento encontrada onde você é responsável e que foi criada por {selectedInteractionPlayer.nome}.
                                    </p>
                                </div>
                            ) : (
                                eligibleSIs.map((os) => {
                                    const isSelected = selectedSIForFinalization === os.id;
                                    return (
                                        <div
                                            key={os.id}
                                            onClick={() => setSelectedSIForFinalization(os.id)}
                                            className={`group relative rounded-2xl border p-4 cursor-pointer transition-all duration-200 ${
                                                isSelected 
                                                    ? 'border-hotel-blue bg-hotel-blue/5 shadow-md shadow-hotel-blue/5' 
                                                    : 'border-slate-150 hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="space-y-1">
                                                    <h4 className="font-bold text-xs text-slate-850 leading-snug line-clamp-2">
                                                        {os.titulo}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-1.5 items-center">
                                                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                                                            {os.departamento}
                                                        </span>
                                                        <span className="text-[9px] text-slate-400 font-semibold">
                                                            Criada em {new Date(os.criado_em).toLocaleDateString('pt-BR')}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                                    isSelected ? 'border-hotel-blue bg-hotel-blue text-white' : 'border-slate-300'
                                                }`}>
                                                    {isSelected && <Check size={10} strokeWidth={3} />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Footer / Action */}
                        <div className="flex gap-3 pt-3 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={handleRequestFinalization}
                                disabled={!selectedSIForFinalization}
                                className="flex-1 rounded-2xl bg-hotel-blue py-3 text-xs font-bold text-white transition-all hover:bg-hotel-blue/90 active:scale-95 disabled:opacity-50 shadow-md shadow-hotel-blue/15"
                            >
                                Solicitar Conclusão
                            </button>
                            <button
                                type="button"
                                onClick={() => setFinalizeFormOpen(false)}
                                className="flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-650 transition-all hover:bg-slate-50 active:scale-95"
                            >
                                Cancelar
                            </button>
                        </div>

                    </div>
                </div>
            )}
        </AppLayout>
    );
}
