import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, Legend, LabelList } from 'recharts';
import { Users, FileText, ShoppingCart, DollarSign, TrendingUp, UserCheck, LayoutDashboard, Settings, Activity, Menu, LogOut, ArrowRight, Bell, Search } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from './lib/supabase';

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  // Ocultar rótulo se a fatia for muito pequena (< 3%)
  if (percent < 0.03) return null;

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.8)' }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const renderOuterLabel = ({ cx, cy, midAngle, outerRadius, percent }: any) => {
  const radius = outerRadius * 1.35;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.03) return null;

  return (
    <text x={x} y={y} fill="#e2e8f0" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize={12} fontWeight="bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1c2237] border border-[#2a3441] p-3 rounded-lg shadow-xl">
        <p className="text-slate-300 mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color || entry.fill }} className="font-bold">
            {entry.name}: {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Main App Component
function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [loading, setLoading] = useState(true);

  // States for charts & metrics
  const [faturamentoData, setFaturamentoData] = useState<any[]>([]);
  const [empresaData, setEmpresaData] = useState<any[]>([]);
  const [empresaPieData, setEmpresaPieData] = useState<any[]>([]);
  const [vendedoresData, setVendedoresData] = useState<any[]>([]);
  const [recebimentosData, setRecebimentosData] = useState<any[]>([]);
  const [ultimasMovimentacoes, setUltimasMovimentacoes] = useState<any[]>([]);
  const [topClientes, setTopClientes] = useState<any[]>([]);
  const [cobrancaData, setCobrancaData] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({ faturamentoMes: 0, aReceber: 0, clientesAtivos: 0, totalPedidos: 0, orcamentos: 0 });

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);

        // Fetch views concurrently
        const [
          { data: viewTotal },
          { data: viewEmpresa },
          { data: pagamentos }
        ] = await Promise.all([
          supabase.from('view_fatu_diario_total').select('*').order('data', { ascending: true }).limit(30),
          supabase.from('view_fatu_diario_por_empresa').select('*').order('data', { ascending: true }).limit(90),
          supabase.from('pagamentos_v2').select('*').order('created_at', { ascending: false }).limit(2000)
        ]);

        // ============================================
        // 1. FATURAMENTO DIÁRIO (LINE CHART)
        // ============================================
        if (viewTotal) {
          const formattedTotal = viewTotal.map(row => ({
            date: format(parseISO(row.data), 'dd/MM'),
            valor: Number(row.fatu_diario || 0)
          }));
          setFaturamentoData(formattedTotal);
        }

        // ============================================
        // 2. FATURAMENTO POR EMPRESA (BAR CHART)
        // ============================================
        if (viewEmpresa) {
          const empMap: Record<string, any> = {};
          let totalIngresso = 0;
          let totalBiro = 0;
          let totalE3 = 0;

          viewEmpresa.forEach(row => {
            const d = format(parseISO(row.data), 'dd/MM');
            if (!empMap[d]) empMap[d] = { date: d, ingresso: 0, biro: 0, e3: 0 };
            const v = Number(row.fatu_diario || 0);

            // Assuming IDs: 1 -> Ingresso Ideal, 2 -> Birô Ideal, 3 -> E3 Brindes
            if (row.id_empresa === 1) { empMap[d].ingresso += v; totalIngresso += v; }
            if (row.id_empresa === 2) { empMap[d].biro += v; totalBiro += v; }
            if (row.id_empresa === 3) { empMap[d].e3 += v; totalE3 += v; }
          });
          setEmpresaData(Object.values(empMap));
          setEmpresaPieData([
            { name: 'Gráfica Expressa', value: totalIngresso, fill: '#3b82f6' },
            { name: 'Birô Serv', value: totalBiro, fill: '#10b981' },
            { name: 'E3/Outra', value: totalE3, fill: '#f59e0b' }
          ].filter(x => x.value > 0));
        }

        // ============================================
        // 3. PAGAMENTOS, RECEBIMENTOS & RANKING
        // ============================================
        if (pagamentos) {
          let recebido = 0;
          let aReceber = 0;
          const vendorsCount: Record<string, number> = {};
          const clientsCount: Record<string, number> = {};
          const cobrancaCount: Record<string, number> = {};
          const unqClients = new Set();

          pagamentos.forEach(p => {
            const v = Number(p.valor || 0);
            if (p.id_cliente) unqClients.add(p.id_cliente);

            // Tipo Cobrança Logic (independentemente do status pago ou não, ou apenas pagos?
            // "representar a soma do faturamento /mes, separado por 'tipo_cobranca' ( PIX, BOLETO, CREDIT_CARD )"
            // Faturamento = Recebido (PAID)
            if (p.status === 'PAID') {
              recebido += v;
              // Ranking Vendedores Logic
              if (p.atendente) {
                vendorsCount[p.atendente] = (vendorsCount[p.atendente] || 0) + v;
              }
              // Ranking Clientes Logic
              if (p.cliente) {
                const clientName = p.cliente.includes(' - ') ? p.cliente.split(' - ')[1] : p.cliente;
                clientsCount[clientName] = (clientsCount[clientName] || 0) + v;
              }
              // Tipo Cobrança Logic
              if (p.tipo_cobranca) {
                cobrancaCount[p.tipo_cobranca] = (cobrancaCount[p.tipo_cobranca] || 0) + v;
              }
            } else {
              aReceber += v;
            }
          });

          // Sort and slice top 8 vendores
          const sortedVendedores = Object.entries(vendorsCount)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);

          // Sort and slice top 10 clientes
          const sortedClientes = Object.entries(clientsCount)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 10);

          // Cobranca charts
          const sortedCobranca = Object.entries(cobrancaCount)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

          setVendedoresData(sortedVendedores);
          setTopClientes(sortedClientes);
          setCobrancaData(sortedCobranca);
          setRecebimentosData([
            { name: 'A Receber', value: aReceber, fill: '#f59e0b' },
            { name: 'Recebido', value: recebido, fill: '#10b981' }
          ]);

          setMetrics({
            faturamentoMes: recebido,
            aReceber: aReceber,
            clientesAtivos: unqClients.size,
            totalPedidos: pagamentos.length,
            orcamentos: 0 // Waiting for table definition
          });

          // Últimas Movimentações (Pegamos as 5 mais recentes de pagamentos_v2)
          const movs = pagamentos.slice(0, 5).map((p, i) => {
            let action = "Registro Alterado";
            if (p.status === 'PAID') action = "Pagamento Aprovado";
            else if (p.status === 'EMITIDO') action = "Nova Cobrança Emitida";
            else if (p.status === 'PENDING') action = "Cobrança Pendente";

            const diffMs = new Date().getTime() - new Date(p.created_at).getTime();
            const hours = Math.floor(diffMs / 3600000);
            const timeStr = hours > 24 ? format(parseISO(p.created_at), 'dd/MM/yy') : hours > 0 ? `${hours}h atrás` : 'Agora há pouco';

            return {
              id: p.id || i,
              action,
              num: `#${p.os_ideal || p.id_int || 'N/A'}`,
              user: p.atendente || 'Sistema',
              time: timeStr
            };
          });
          setUltimasMovimentacoes(movs);
        }

      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000); // 5 minutes refresh
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#131826] text-slate-100 flex overflow-hidden font-sans">

      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#1c2237] border-r border-[#2a3441] transition-all duration-300 ease-in-out flex flex-col z-20`}>
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#2a3441]">
          {isSidebarOpen && <span className="font-bold text-xl bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent truncate ml-1">Painel Ideal</span>}
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-lg hover:bg-[#2a3441] text-slate-400 hover:text-white transition-colors">
            <Menu size={20} />
          </button>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-2 px-3">
          {[
            { icon: LayoutDashboard, label: 'Dashboard', active: true },
            { icon: Users, label: 'Clientes' },
            { icon: ShoppingCart, label: 'Pedidos' },
            { icon: FileText, label: 'Orçamentos' },
            { icon: DollarSign, label: 'Financeiro' },
            { icon: Settings, label: 'Configurações' },
          ].map((item, index) => (
            <button key={index} className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative ${item.active ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-[#2a3441] hover:text-white'}`}>
              <item.icon size={20} className={item.active ? 'text-blue-400' : 'text-slate-400 group-hover:text-white transition-colors'} />
              {isSidebarOpen && <span className="font-medium whitespace-nowrap overflow-hidden">{item.label}</span>}
              {!isSidebarOpen && (
                <div className="absolute left-14 bg-[#2a3441] text-white px-2 py-1 rounded-md text-sm opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl border border-slate-700">
                  {item.label}
                </div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-[#2a3441]">
          <button className="flex items-center gap-3 w-full px-3 py-3 rounded-xl text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition-colors justify-center md:justify-start">
            <LogOut size={20} />
            {isSidebarOpen && <span className="font-medium">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">

        {loading && (
          <div className="absolute inset-0 z-50 bg-[#131826]/80 backdrop-blur-sm flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* Header */}
        <header className="h-16 bg-[#131826] border-b border-[#2a3441] flex items-center justify-between px-6 z-10 w-full shrink-0">
          <div className="relative w-64 md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Pesquisar..."
              className="w-full bg-[#1c2237] border border-[#2a3441] rounded-full py-2 pl-10 pr-4 text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-500"
            />
          </div>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full hover:bg-[#2a3441] text-slate-400 transition-colors">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-[#131826]"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 flex items-center justify-center text-sm font-bold shadow-lg cursor-pointer">
              EU
            </div>
          </div>
        </header>

        {/* Dashboard Scrollable Body */}
        <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-[1600px] mx-auto space-y-6">

            {/* Top Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-4 flex flex-col justify-center shadow-lg shadow-black/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[#94a3b8] text-[10px] font-bold tracking-wider">FATURAMENTO</span>
                  <div className="p-1 rounded bg-blue-500/10">
                    <TrendingUp size={14} className="text-blue-500" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.faturamentoMes)}
                </div>
                <div className="text-[#64748b] text-[11px]">Pagamentos Processados</div>
              </div>

              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-4 flex flex-col justify-center shadow-lg shadow-black/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[#94a3b8] text-[10px] font-bold tracking-wider">A RECEBER</span>
                  <div className="p-1 rounded bg-yellow-500/10">
                    <DollarSign size={14} className="text-yellow-500" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.aReceber)}
                </div>
                <div className="text-[#64748b] text-[11px]">Em aberto</div>
              </div>

              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-4 flex flex-col justify-center shadow-lg shadow-black/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[#94a3b8] text-[10px] font-bold tracking-wider">CLIENTES ATIVOS</span>
                  <div className="p-1 bg-emerald-500/10 rounded">
                    <UserCheck size={14} className="text-emerald-500" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{metrics.clientesAtivos.toLocaleString('pt-BR')}</div>
                <div className="text-[#64748b] text-[11px]">Clientes únicos recentes</div>
              </div>

              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-4 flex flex-col justify-center shadow-lg shadow-black/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[#94a3b8] text-[10px] font-bold tracking-wider">TOTAL DE PEDIDOS</span>
                  <div className="p-1 bg-purple-500/10 rounded">
                    <ShoppingCart size={14} className="text-purple-500" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mb-1">{metrics.totalPedidos.toLocaleString('pt-BR')}</div>
                <div className="text-[#64748b] text-[11px]">Volume no período</div>
              </div>

              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-4 flex flex-col justify-center shadow-lg shadow-black/20">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-[#94a3b8] text-[10px] font-bold tracking-wider">ORÇAMENTOS</span>
                  <div className="p-1 bg-cyan-500/10 rounded">
                    <FileText size={14} className="text-cyan-500" />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mb-1">...</div>
                <div className="text-[#64748b] text-[11px]">Dados pendentes</div>
              </div>
            </div>

            {/* Faturamento Diário Area Chart */}
            <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-5 shadow-lg shadow-black/20">
              <h2 className="text-base font-bold text-white mb-0">Faturamento Diário — Total</h2>
              <p className="text-[#64748b] text-xs mb-6">Visualização da View (Total Processado)</p>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={faturamentoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value / 1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="valor" name="Faturamento" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorValor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Mid Row: Empresa Bar Chart, Empresa Pie Chart & Recebimentos Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-5 shadow-lg shadow-black/20">
                <h2 className="text-base font-bold text-white mb-0">Faturamento Diário por Empresa</h2>
                <p className="text-[#64748b] text-xs mb-6">Consolidado por Identificador</p>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={empresaData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                      <XAxis dataKey="date" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#2a3441', opacity: 0.4 }} />
                      <Legend verticalAlign="bottom" height={36} iconType="square" iconSize={10} wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                      <Bar dataKey="ingresso" name="Gráfica Expressa (1)" stackId="a" fill="#3b82f6" />
                      <Bar dataKey="biro" name="Birô Serv (2)" stackId="a" fill="#10b981" />
                      <Bar dataKey="e3" name="E3/Outra (3)" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-5 shadow-lg shadow-black/20">
                <h2 className="text-base font-bold text-white mb-0">Total Mensal por Empresa</h2>
                <p className="text-[#64748b] text-xs mb-6">Faturamento Acumulado (Mês)</p>
                <div className="h-[260px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={empresaPieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        labelLine={false}
                        label={renderOuterLabel}
                      >
                        {empresaPieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value as number)} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#94a3b8', bottom: -10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-5 shadow-lg shadow-black/20">
                <h2 className="text-base font-bold text-white mb-0">Faturamento por Tipo de Recebimento</h2>
                <p className="text-[#64748b] text-xs mb-6">Mês atual - (PIX, Boleto, Cartão)</p>
                <div className="h-[260px] w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cobrancaData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                        labelLine={false}
                        label={renderOuterLabel}
                      >
                        {cobrancaData.map((_, index) => {
                          const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Pie>
                      <Tooltip formatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value as number)} />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#94a3b8', bottom: -10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top 10 Clientes Chart */}
            <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-5 shadow-lg shadow-black/20">
              <h2 className="text-base font-bold text-white mb-0">Top 10 Clientes</h2>
              <p className="text-[#64748b] text-xs mb-6">Maior faturamento acumulado</p>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topClientes} layout="vertical" margin={{ top: 0, right: 30, left: 100, bottom: 0 }}>
                    <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value / 1000}k`} />
                    <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={180} />
                    <Bar dataKey="value" name="Faturamento" radius={[0, 4, 4, 0]} barSize={16}>
                      {topClientes.map((_, index) => {
                        const colors = ['#3b82f6', '#10b981', '#a855f7', '#d946ef', '#f43f5e', '#06b6d4', '#6366f1', '#14b8a6', '#f59e0b', '#1e293b'];
                        return <Cell key={`cell-${index}`} fill={colors[0]} />;
                      })}
                      <LabelList dataKey="value" position="right" fill="#94a3b8" fontSize={11} formatter={(val: any) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(Number(val))} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bottom Row: Ranking, Recebimentos & Movimentações */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-5 shadow-lg shadow-black/20 lg:col-span-1">
                <h2 className="text-base font-bold text-white mb-0">Ranking de Vendedores</h2>
                <p className="text-[#64748b] text-xs mb-4">Métricas via pagamentos confirmados</p>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendedoresData} layout="vertical" margin={{ top: 0, right: 20, left: 35, bottom: 0 }}>
                      <XAxis type="number" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `R$${value / 1000}k`} />
                      <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={80} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: '#2a3441', opacity: 0.4 }} />
                      <Bar dataKey="value" name="Vendas" radius={[0, 4, 4, 0]} barSize={12}>
                        {vendedoresData.map((_, index) => {
                          const colors = ['#3b82f6', '#10b981', '#a855f7', '#d946ef', '#f43f5e', '#06b6d4', '#6366f1', '#14b8a6'];
                          return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-5 shadow-lg shadow-black/20 lg:col-span-1 flex flex-col">
                <div>
                  <h2 className="text-base font-bold text-white mb-0">Recebimentos</h2>
                  <p className="text-[#64748b] text-xs mb-2">Status financeiro consolidado (v2)</p>
                </div>

                <div className="flex-1 min-h-[160px] pb-4 relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={recebimentosData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        labelLine={false}
                        label={renderCustomizedLabel}
                      >
                        {recebimentosData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value as number)} />
                      <Legend verticalAlign="bottom" height={36} iconType="square" iconSize={10} wrapperStyle={{ fontSize: '11px', color: '#94a3b8', bottom: -15 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-auto">
                  <div className="bg-[#131826] rounded-lg p-2.5 border border-emerald-500/20 text-center">
                    <p className="text-[#64748b] text-[10px] mb-0.5">Recebido</p>
                    <p className="text-emerald-400 font-bold text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.faturamentoMes)}</p>
                  </div>
                  <div className="bg-[#131826] rounded-lg p-2.5 border border-yellow-500/20 text-center">
                    <p className="text-[#64748b] text-[10px] mb-0.5">A Receber</p>
                    <p className="text-yellow-500 font-bold text-sm">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.aReceber)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-[#1c2237] border border-[#2a3441] rounded-xl p-5 shadow-lg shadow-black/20 lg:col-span-1">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h2 className="text-base font-bold text-white mb-0">Últimas Movimentações</h2>
                    <p className="text-[#64748b] text-xs">Atividade recente de cobranças</p>
                  </div>
                  <button className="text-blue-400 hover:text-blue-300 transition-colors">
                    <ArrowRight size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  {ultimasMovimentacoes.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-[#131826] border border-[#2a3441] hover:border-slate-700 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#1c2237] flex items-center justify-center shrink-0">
                          <Activity size={14} className={item.action.includes('Pendente') ? 'text-yellow-400' : 'text-emerald-400'} />
                        </div>
                        <div className="overflow-hidden max-w-[130px]">
                          <p className="text-sm text-slate-200 font-medium truncate">{item.action}</p>
                          <p className="text-[10px] text-[#64748b] truncate">{item.num} • {item.user}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-[#64748b] whitespace-nowrap ml-2">{item.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
