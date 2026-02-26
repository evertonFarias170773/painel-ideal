import { useState, useEffect } from 'react';
import { Search, Plus, Eraser, Move, Menu as MenuIcon, Edit, CheckSquare, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Cliente {
    id: number;
    id_cliente?: number;
    nome?: string;
    fantasia?: string;
    documento?: string;
    cnpj?: string;
    cpf?: string;
    cidade_uf?: string;
    nome_vendedor?: string;
    whatsapp1?: string;
    celular?: string;
    ativo?: boolean | string | number;
    ult_pedido?: string;
    qtd?: number;
    [key: string]: any;
}

export default function ClientesPage() {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [loading, setLoading] = useState(false);

    // Filters
    const [filtroAtivos, setFiltroAtivos] = useState(true);
    const [filtroId, setFiltroId] = useState('');
    const [filtroNome, setFiltroNome] = useState('');
    const [filtroDoc, setFiltroDoc] = useState('');
    const [filtroWhats, setFiltroWhats] = useState('');

    const limparFiltros = () => {
        setFiltroAtivos(true);
        setFiltroId('');
        setFiltroNome('');
        setFiltroDoc('');
        setFiltroWhats('');
        // Wait for state updates before fetching
        setTimeout(() => {
            fetchClientes(true);
        }, 0);
    };

    const fetchClientes = async (resetFilters = false) => {
        setLoading(true);
        try {
            let query = supabase.from('clientes').select('*').limit(50);

            const isAtivos = resetFilters ? true : filtroAtivos;
            const idStr = resetFilters ? '' : filtroId;
            const nomeStr = resetFilters ? '' : filtroNome;
            const docStr = resetFilters ? '' : filtroDoc;
            const whatsStr = resetFilters ? '' : filtroWhats;

            // Filter by 'ativo'
            // Na maioria dos bancos postgres é um boolean 'ativo' = true.
            query = query.eq('ativo', isAtivos);

            if (idStr && !isNaN(Number(idStr))) {
                query = query.eq('id_cliente', Number(idStr)); // usually searching external ID
            }

            if (nomeStr) {
                query = query.or(`nome.ilike.%${nomeStr}%,fantasia.ilike.%${nomeStr}%`);
            }

            if (docStr) {
                const docLimpo = docStr.replace(/[^a-zA-Z0-9]/g, '');
                // Searching both raw and cleaned inputs only in 'documento' to prevent errors if cnpj/cpf columns don't exist
                query = query.or(`documento.ilike.%${docStr}%,documento.ilike.%${docLimpo}%`);
            }

            if (whatsStr) {
                const whatsLimpo = whatsStr.replace(/[^0-9]/g, '');
                query = query.or(`whatsapp1.ilike.%${whatsStr}%,whatsapp1.ilike.%${whatsLimpo}%`);
            }

            const { data, error } = await query;
            if (error) {
                console.warn("Aviso:", error.message);
                // Se 'ativo' ou outra coluna não existir do jeito esperado:
                // Como fallback, podemos tentar buscar sem os filtros quebrados mas para segurança apenas limpamos a lista.
                setClientes([]);
                return;
            }
            let clientesData = data || [];

            // Buscar informações adicionais de pedidos (qts e ult_pedido) 
            if (clientesData.length > 0) {
                const ids = clientesData.map(c => c.id_cliente).filter(Boolean);
                if (ids.length > 0) {
                    const { data: propostasData, error: propErr } = await supabase
                        .from('propostas')
                        .select('id_cliente, status, created_at')
                        .in('id_cliente', ids);

                    if (!propErr && propostasData) {
                        clientesData = clientesData.map(c => {
                            const clientProps = propostasData.filter((p: any) => p.id_cliente === c.id_cliente);
                            const qtd = clientProps.length;

                            const quitadas = clientProps.filter((p: any) => p.status === 'QUITADA' || p.status === 'PAID');
                            let ult = '-';
                            if (quitadas.length > 0) {
                                quitadas.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                                const dateObj = new Date(quitadas[0].created_at);
                                ult = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
                            }

                            return { ...c, qtd, ult_pedido: ult };
                        });
                    }
                }
            }

            setClientes(clientesData);
        } catch (err) {
            console.error('Erro ao buscar clientes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClientes();
        // eslint-disable-next-line
    }, [filtroAtivos]); // Refetch on ativo toggle

    const formatDocument = (doc?: string) => {
        if (!doc) return '-';
        // Simplification para visualização, a máscara correta dependeria do tamanho.
        return doc.length > 11 ? `CNPJ/CPF - ${doc}` : `CPF - ${doc}`;
    }

    return (
        <div className="flex flex-col h-full bg-[#131826] text-slate-200">

            {/* Top Header */}
            <div className="bg-[#1c2237] border-b border-[#2a3441] p-4 flex items-center justify-between shadow-sm z-10">
                <h1 className="text-[15px] font-bold text-white flex items-center gap-2">
                    <span className="text-teal-500 bg-teal-500/10 px-2 py-0.5 rounded mr-1">Relação de cadastros</span>
                    <span className="text-[#94a3b8] font-normal">-</span>
                    <span>Clientes / Fornecedores / Transportadoras</span>
                </h1>
            </div>

            <div className="flex-1 overflow-auto p-6 space-y-6">

                {/* Sub Header & Actions */}
                <div className="bg-[#1c2237] rounded-xl border border-[#2a3441] p-5 shadow-lg shadow-black/20">
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2a3441]">
                        <h2 className="text-base font-bold text-blue-400 items-center flex gap-2">
                            <span className="bg-blue-500/20 px-2 py-1.5 rounded-md text-blue-400 text-sm">📄</span>
                            Lista geral do cadastro
                        </h2>
                        <button className="bg-[#15192b] hover:bg-[#2a3441] border border-[#2a3441] text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 shadow-sm text-sm">
                            <Plus size={16} /> Novo cadastro
                        </button>
                    </div>

                    {/* Filters Row */}
                    <div className="flex flex-wrap gap-4 items-end">
                        {/* Ativos */}
                        <div className="flex flex-col gap-1.5 pt-1">
                            <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">Ativos?</label>
                            <button
                                onClick={() => setFiltroAtivos(!filtroAtivos)}
                                className={`h-[38px] px-4 rounded-md font-bold flex items-center gap-2 border transition-all ${filtroAtivos ? 'bg-teal-500/10 border-teal-500/30 text-teal-400 shadow-[inset_0_1px_4px_rgba(20,184,166,0.1)]' : 'bg-[#15192b] border-[#2a3441] text-[#64748b] hover:border-slate-600'}`}>
                                <div className={`w-[14px] h-[14px] rounded-[3px] shadow-sm flex items-center justify-center border transition-all ${filtroAtivos ? 'border-teal-400 bg-teal-500 text-white' : 'border-slate-600 bg-[#1c2237]'}`}>
                                    {filtroAtivos && <span className="text-[10px] leading-none mb-[1px]">✔</span>}
                                </div>
                                <span className="text-[13px]">{filtroAtivos ? 'SIM' : 'NÃO'}</span>
                            </button>
                        </div>

                        {/* ID Cliente */}
                        <div className="flex flex-col gap-1.5 max-w-[140px]">
                            <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">ID DO CLIENTE</label>
                            <div className="flex h-[38px] shadow-sm rounded-md">
                                <input type="text" value={filtroId} onChange={(e) => setFiltroId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchClientes()} placeholder="Ex. 50602" className="w-full bg-[#15192b] border border-[#2a3441] rounded-l-md px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-600 font-medium" />
                                <button onClick={() => fetchClientes()} className="bg-[linear-gradient(180deg,#94a3b8,#64748b)] hover:brightness-110 text-white border border-l-0 border-[#64748b] px-3 rounded-r-md transition-all flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                                    <Search size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Nome */}
                        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                            <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">NOME CLIENTE</label>
                            <input type="text" value={filtroNome} onChange={(e) => setFiltroNome(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchClientes()} placeholder="Nome do cliente" className="h-[38px] bg-[#15192b] border border-[#2a3441] rounded-md px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-colors shadow-sm placeholder:text-slate-600 font-medium" />
                        </div>

                        {/* CNPJ/CPF */}
                        <div className="flex flex-col gap-1.5 min-w-[180px]">
                            <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">CNPJ/CPF</label>
                            <input type="text" value={filtroDoc} onChange={(e) => setFiltroDoc(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchClientes()} placeholder="Ex. 99.999.999/0001-99" className="h-[38px] bg-[#15192b] border border-[#2a3441] rounded-md px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-colors shadow-sm placeholder:text-slate-600 font-medium" />
                        </div>

                        {/* WHATSAPP */}
                        <div className="flex flex-col gap-1.5 min-w-[150px]">
                            <label className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider">WHATSAPP</label>
                            <div className="flex h-[38px] shadow-sm rounded-md">
                                <input type="text" value={filtroWhats} onChange={(e) => setFiltroWhats(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchClientes()} placeholder="Ex.5199999999" className="w-full bg-[#15192b] border border-[#2a3441] rounded-l-md px-3 text-[13px] focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-600 font-medium" />
                                <button onClick={limparFiltros} title="Limpar filtros" className="bg-[linear-gradient(180deg,#94a3b8,#64748b)] hover:bg-[linear-gradient(180deg,#f43f5e,#e11d48)] hover:border-rose-500 group text-white border border-l-0 border-[#64748b] px-3 rounded-r-md transition-all flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                                    <Eraser size={14} className="group-hover:animate-pulse" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Data Table Container */}
                <div className="bg-[#1c2237] rounded-xl border border-[#2a3441] overflow-hidden flex flex-col shadow-lg shadow-black/20">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-[13px] whitespace-nowrap">
                            <thead>
                                <tr className="bg-[#15192b] text-[#94a3b8] font-bold text-[11px] border-b border-[#2a3441]">
                                    <th className="px-5 py-3.5 tracking-wider">ID</th>
                                    <th className="px-5 py-3.5 w-[30%] min-w-[200px] tracking-wider">CLIENTE</th>
                                    <th className="px-5 py-3.5 tracking-wider">LOCALIDADE</th>
                                    <th className="px-5 py-3.5 tracking-wider">DOCUMENTO</th>
                                    <th className="px-5 py-3.5 tracking-wider">ATENDENTE</th>
                                    <th className="px-5 py-3.5 tracking-wider">ULT. PEDIDO</th>
                                    <th className="px-5 py-3.5 tracking-wider">QTD</th>
                                    <th className="px-5 py-3.5 text-center tracking-wider">AÇÕES / APROVAR</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2a3441]/60 text-[#cbd5e1]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-10 text-center text-[#64748b]">
                                            <Loader2 size={24} className="animate-spin mx-auto mb-3 text-blue-500" />
                                            Pesquisando registros no banco de dados...
                                        </td>
                                    </tr>
                                ) : clientes.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-5 py-10 text-center text-[#64748b] font-medium bg-[#1c2237]">
                                            <div className="mx-auto w-12 h-12 bg-[#15192b] rounded-full flex items-center justify-center mb-3 text-slate-500">
                                                <Search size={20} />
                                            </div>
                                            Nenhum cliente localizado com os filtros informados.
                                        </td>
                                    </tr>
                                ) : (
                                    clientes.map((c, i) => (
                                        <tr key={c.id || i} className="hover:bg-[#2a3441]/40 transition-colors group cursor-default">
                                            <td className="px-5 py-3 font-extrabold text-[#818cf8]">{c.id_cliente || c.id || '-'}</td>
                                            <td className="px-5 py-3 font-semibold text-white">
                                                <div className="truncate max-w-[320px]" title={c.nome || c.fantasia}>
                                                    {c.nome || c.fantasia || '-'}
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-[#94a3b8]">{c.cidade_uf || '-'}</td>
                                            <td className="px-5 py-3 text-[#cbd5e1] font-mono text-xs">{formatDocument(c.documento || c.cnpj || c.cpf)}</td>
                                            <td className="px-5 py-3 text-[#94a3b8]">{c.nome_vendedor || '-'}</td>
                                            <td className="px-5 py-3 text-[#94a3b8]">{c.ult_pedido || '-'}</td>
                                            <td className="px-5 py-3 font-bold text-[#e2e8f0]">{c.qtd !== undefined ? c.qtd : '-'}</td>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center justify-center gap-1.5">
                                                    <button className="p-1.5 text-[#64748b] hover:text-white transition-colors" title="Mover">
                                                        <Move size={15} />
                                                    </button>
                                                    <button className="p-1.5 bg-teal-500/10 text-teal-400 hover:bg-teal-500 hover:text-white rounded-md transition-colors" title="Opções">
                                                        <MenuIcon size={15} />
                                                    </button>
                                                    <button className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-md transition-colors" title="Editar">
                                                        <Edit size={15} />
                                                    </button>
                                                    <button className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-md transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]" title="Aprovar">
                                                        <CheckSquare size={15} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {!loading && clientes.length > 0 && (
                        <div className="bg-[#15192b] border-t border-[#2a3441] p-3 text-[11px] font-medium text-[#64748b] text-center flex justify-between items-center px-5">
                            <span>Exibindo os primeiros resultados localizados</span>
                            <span className="bg-[#1c2237] px-2 py-0.5 rounded text-[#94a3b8] border border-[#2a3441]">{clientes.length} resultados</span>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
