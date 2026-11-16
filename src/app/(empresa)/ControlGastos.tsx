import React, { useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    TextInput,
    StyleSheet,
    Modal,
    Platform,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// ============================================================================
// TIPOS Y ESTRUCTURA FISCAL (CONDOS + EMPRESA + DGII 606)
// ============================================================================
export type AmbitoGasto = 'CONDOMINIO' | 'EMPRESA';

export type CategoriaGasto =
    | 'LUZ_SERVICIO'
    | 'AGUA_SERVICIO'
    | 'SISTEMA_SEGURIDAD'
    | 'FUTURA_REPARACION'
    | 'COMBUSTIBLE_VEHICULOS'
    | 'PROMO_MARKETING'
    | 'LOCAL_OFICINA'
    | 'PERSONALIZADO';

export interface GastoProgramado {
    id: string;
    ambito: AmbitoGasto;
    entidadDestino: string; // Ej: "Residencial Santos I" o "JR Technology (Oficina Central)"
    categoria: CategoriaGasto;
    concepto: string;
    proveedor: string;
    rncProveedor: string;
    ncf: string; // Ej: B0100001234 o E3100000045
    tipo606: string; // Clasificación oficial DGII
    fechaISO: string; // YYYY-MM-DD (Para ubicarlo en el calendario por día)
    subtotal: number;
    itbis: number;
    montoTotal: number;
    metodoPago: 'TRANSFERENCIA' | 'TARJETA_CORPORATIVA' | 'EFECTIVO';
    estado: 'PAGADO' | 'PROGRAMADO_FUTURO' | 'VENCIDO';
    recurrenteMensual: boolean;
}

const CATEGORIAS_CONFIG: Record<
    CategoriaGasto,
    { label: string; icon: string; color: string; bg: string; tipo606Default: string }
> = {
    LUZ_SERVICIO: {
        label: 'Servicio de Luz (EDENORTE / EDE)',
        icon: 'zap',
        color: '#D97706',
        bg: '#FEF3C7',
        tipo606Default: '02 - Gastos por Trabajos, Suministros y Servicios',
    },
    AGUA_SERVICIO: {
        label: 'Servicio de Agua (CORAASAN / CAASD)',
        icon: 'droplet',
        color: '#0284C7',
        bg: '#E0F2FE',
        tipo606Default: '02 - Gastos por Trabajos, Suministros y Servicios',
    },
    SISTEMA_SEGURIDAD: {
        label: 'Sistema de Seguridad / Cámaras',
        icon: 'shield',
        color: '#4F46E5',
        bg: '#EEF2FF',
        tipo606Default: '02 - Gastos por Trabajos, Suministros y Servicios',
    },
    FUTURA_REPARACION: {
        label: 'Reparación Programada / Mantenimiento',
        icon: 'tool',
        color: '#DC2626',
        bg: '#FEE2E2',
        tipo606Default: '04 - Gastos de Activos Fijos',
    },
    COMBUSTIBLE_VEHICULOS: {
        label: 'Combustible de Vehículos / Flota',
        icon: 'truck',
        color: '#15803D',
        bg: '#DCFCE7',
        tipo606Default: '02 - Gastos por Trabajos, Suministros y Servicios',
    },
    PROMO_MARKETING: {
        label: 'Pago de Promo / Publicidad',
        icon: 'trending-up',
        color: '#9333EA',
        bg: '#F3E8FF',
        tipo606Default: '05 - Gastos de Representación',
    },
    LOCAL_OFICINA: {
        label: 'Luz, Agua e Internet del Local',
        icon: 'home',
        color: '#334155',
        bg: '#F1F5F9',
        tipo606Default: '02 - Gastos por Trabajos, Suministros y Servicios',
    },
    PERSONALIZADO: {
        label: 'Otro Gasto / Registro Manual',
        icon: 'file-plus',
        color: '#0F766E',
        bg: '#CCFBF1',
        tipo606Default: '02 - Gastos por Trabajos, Suministros y Servicios',
    },
};

const NOMBRES_MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DIAS_SEMANA_HEADER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const formatearISO = (anio: number, mesIndex: number, dia: number): string => {
    const m = String(mesIndex + 1).padStart(2, '0');
    const d = String(dia).padStart(2, '0');
    return `${anio}-${m}-${d}`;
};

export default function ControlGastos() {
    const hoy = new Date();
    const [anioActual, setAnioActual] = useState(hoy.getFullYear());
    const [mesActual, setMesActual] = useState(hoy.getMonth()); // 0 = Enero

    const [vistaFiltro, setVistaFiltro] = useState<'TODOS' | 'CONDOMINIO' | 'EMPRESA' | 'DGII_606'>('TODOS');
    const [diaSeleccionadoISO, setDiaSeleccionadoISO] = useState<string | null>(null);

    // Datos iniciales de ejemplo en el mes activo
    const [gastos, setGastos] = useState<GastoProgramado[]>([
        {
            id: 'G-101',
            ambito: 'CONDOMINIO',
            entidadDestino: 'Residencial Santos I',
            categoria: 'LUZ_SERVICIO',
            concepto: 'Factura Luz Área Común y Escalera',
            proveedor: 'EDENORTE Dominicana',
            rncProveedor: '101874912',
            ncf: 'E310000491821',
            tipo606: '02 - Gastos por Trabajos, Suministros y Servicios',
            fechaISO: formatearISO(hoy.getFullYear(), hoy.getMonth(), 5),
            subtotal: 4200,
            itbis: 0,
            montoTotal: 4200,
            metodoPago: 'TRANSFERENCIA',
            estado: 'PAGADO',
            recurrenteMensual: true,
        },
        {
            id: 'G-102',
            ambito: 'CONDOMINIO',
            entidadDestino: 'Residencial Santos I',
            categoria: 'AGUA_SERVICIO',
            concepto: 'Servicio de Agua Potable Mensual',
            proveedor: 'CORAASAN',
            rncProveedor: '402001829',
            ncf: 'B0100091827',
            tipo606: '02 - Gastos por Trabajos, Suministros y Servicios',
            fechaISO: formatearISO(hoy.getFullYear(), hoy.getMonth(), 10),
            subtotal: 1500,
            itbis: 0,
            montoTotal: 1500,
            metodoPago: 'TRANSFERENCIA',
            estado: 'PAGADO',
            recurrenteMensual: true,
        },
        {
            id: 'G-103',
            ambito: 'EMPRESA',
            entidadDestino: 'JR Technology (Flota)',
            categoria: 'COMBUSTIBLE_VEHICULOS',
            concepto: 'Combustible Flota de Mecánicos y Supervisores',
            proveedor: 'Estación Shell / Isla',
            rncProveedor: '101029384',
            ncf: 'E310000192834',
            tipo606: '02 - Gastos por Trabajos, Suministros y Servicios',
            fechaISO: formatearISO(hoy.getFullYear(), hoy.getMonth(), 14),
            subtotal: 5500,
            itbis: 0,
            montoTotal: 5500,
            metodoPago: 'TARJETA_CORPORATIVA',
            estado: 'PAGADO',
            recurrenteMensual: false,
        },
        {
            id: 'G-104',
            ambito: 'CONDOMINIO',
            entidadDestino: 'Residencial Las Acacias',
            categoria: 'SISTEMA_SEGURIDAD',
            concepto: 'Mantenimiento Cámaras CCTV y Cerco Eléctrico',
            proveedor: 'Seguridad Electrónica SRL',
            rncProveedor: '131492817',
            ncf: 'B0100004412',
            tipo606: '02 - Gastos por Trabajos, Suministros y Servicios',
            fechaISO: formatearISO(hoy.getFullYear(), hoy.getMonth(), 20),
            subtotal: 3000,
            itbis: 540,
            montoTotal: 3540,
            metodoPago: 'TRANSFERENCIA',
            estado: 'PROGRAMADO_FUTURO',
            recurrenteMensual: true,
        },
        {
            id: 'G-105',
            ambito: 'EMPRESA',
            entidadDestino: 'JR Technology (Oficina Central)',
            categoria: 'PROMO_MARKETING',
            concepto: 'Campaña Publicitaria Meta Ads & Google',
            proveedor: 'Agencia Digital / Meta Platforms',
            rncProveedor: '130992811',
            ncf: 'B0100008821',
            tipo606: '05 - Gastos de Representación',
            fechaISO: formatearISO(hoy.getFullYear(), hoy.getMonth(), 25),
            subtotal: 4000,
            itbis: 720,
            montoTotal: 4720,
            metodoPago: 'TARJETA_CORPORATIVA',
            estado: 'PROGRAMADO_FUTURO',
            recurrenteMensual: true,
        },
        {
            id: 'G-106',
            ambito: 'CONDOMINIO',
            entidadDestino: 'Residencial Santos I',
            categoria: 'FUTURA_REPARACION',
            concepto: 'Cambio Programado de Rodamientos Bomba #2',
            proveedor: 'Ferretería Ochoa / Taller Industrial',
            rncProveedor: '102003918',
            ncf: 'E310000991200',
            tipo606: '04 - Gastos de Activos Fijos',
            fechaISO: formatearISO(hoy.getFullYear(), hoy.getMonth(), 28),
            subtotal: 6500,
            itbis: 1170,
            montoTotal: 7670,
            metodoPago: 'TRANSFERENCIA',
            estado: 'PROGRAMADO_FUTURO',
            recurrenteMensual: false,
        },
    ]);

    // Estados del Modal de Registro Manual / Futuro
    const [modalVisible, setModalVisible] = useState(false);
    const [ambitoForm, setAmbitoForm] = useState<AmbitoGasto>('CONDOMINIO');
    const [entidadForm, setEntidadForm] = useState('Residencial Santos I');
    const [categoriaForm, setCategoriaForm] = useState<CategoriaGasto>('LUZ_SERVICIO');
    const [conceptoForm, setConceptoForm] = useState('');
    const [proveedorForm, setProveedorForm] = useState('');
    const [rncForm, setRncForm] = useState('');
    const [ncfForm, setNcfForm] = useState('');
    const [fechaFormISO, setFechaFormISO] = useState(formatearISO(anioActual, mesActual, hoy.getDate()));
    const [subtotalForm, setSubtotalForm] = useState('');
    const [aplicaItbis, setAplicaItbis] = useState(false);
    const [estadoForm, setEstadoForm] = useState<'PAGADO' | 'PROGRAMADO_FUTURO'>('PROGRAMADO_FUTURO');
    const [metodoForm, setMetodoForm] = useState<'TRANSFERENCIA' | 'TARJETA_CORPORATIVA' | 'EFECTIVO'>('TRANSFERENCIA');

    // Cambiar de mes en el calendario
    const cambiarMes = (delta: number) => {
        let nuevoMes = mesActual + delta;
        let nuevoAnio = anioActual;
        if (nuevoMes > 11) {
            nuevoMes = 0;
            nuevoAnio += 1;
        } else if (nuevoMes < 0) {
            nuevoMes = 11;
            nuevoAnio -= 1;
        }
        setMesActual(nuevoMes);
        setAnioActual(nuevoAnio);
        setDiaSeleccionadoISO(null);
    };

    // Construir cuadrícula de días del mes (Lunes a Domingo)
    const construirDiasCalendario = () => {
        const primerDiaSemana = new Date(anioActual, mesActual, 1).getDay(); // 0 = Dom
        const celdasVaciasInicio = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;
        const totalDiasMes = new Date(anioActual, mesActual + 1, 0).getDate();

        const celdas: Array<{ dia: number | null; fechaISO: string | null }> = [];
        for (let i = 0; i < celdasVaciasInicio; i++) {
            celdas.push({ dia: null, fechaISO: null });
        }
        for (let d = 1; d <= totalDiasMes; d++) {
            celdas.push({ dia: d, fechaISO: formatearISO(anioActual, mesActual, d) });
        }
        return celdas;
    };

    const abrirModalEnFecha = (fechaISO?: string, ambitoPre?: AmbitoGasto) => {
        const f = fechaISO || formatearISO(anioActual, mesActual, hoy.getDate());
        setFechaFormISO(f);
        if (ambitoPre) {
            setAmbitoForm(ambitoPre);
            setEntidadForm(ambitoPre === 'CONDOMINIO' ? 'Residencial Santos I' : 'JR Technology (Oficina Central)');
            setCategoriaForm(ambitoPre === 'CONDOMINIO' ? 'LUZ_SERVICIO' : 'COMBUSTIBLE_VEHICULOS');
        }
        setConceptoForm('');
        setProveedorForm('');
        setRncForm('');
        setNcfForm('');
        setSubtotalForm('');
        setAplicaItbis(false);
        setEstadoForm('PROGRAMADO_FUTURO');
        setModalVisible(true);
    };

    const guardarGasto = () => {
        const sub = parseFloat(subtotalForm) || 0;
        if (sub <= 0) return;

        const itbisCalc = aplicaItbis ? parseFloat((sub * 0.18).toFixed(2)) : 0;
        const totalCalc = sub + itbisCalc;
        const catInfo = CATEGORIAS_CONFIG[categoriaForm];

        const nuevo: GastoProgramado = {
            id: `G-${Date.now()}`,
            ambito: ambitoForm,
            entidadDestino: entidadForm,
            categoria: categoriaForm,
            concepto: conceptoForm.trim() || catInfo.label,
            proveedor: proveedorForm.trim() || 'Proveedor General',
            rncProveedor: rncForm.trim() || '101000000',
            ncf: ncfForm.trim() || 'B0100000001',
            tipo606: catInfo.tipo606Default,
            fechaISO: fechaFormISO,
            subtotal: sub,
            itbis: itbisCalc,
            montoTotal: totalCalc,
            metodoPago: metodoForm,
            estado: estadoForm,
            recurrenteMensual: categoriaForm !== 'FUTURA_REPARACION',
        };

        setGastos([nuevo, ...gastos]);
        setModalVisible(false);
    };

    const marcarComoPagado = (id: string) => {
        setGastos((prev) =>
            prev.map((g) => (g.id === id ? { ...g, estado: 'PAGADO' } : g))
        );
    };

    // Exportar Pre-Reporte 606 de la DGII para Contabilidad
    const exportarReporteDGII606 = () => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const filas = gastos
                .map(
                    (g) => `
                <tr>
                    <td>${g.rncProveedor}</td>
                    <td><b>${g.ncf}</b></td>
                    <td>${g.tipo606}</td>
                    <td>${g.fechaISO.replace(/-/g, '')}</td>
                    <td>${g.proveedor} (${g.concepto})</td>
                    <td style="text-align:right;">RD$ ${g.subtotal.toFixed(2)}</td>
                    <td style="text-align:right;">RD$ ${g.itbis.toFixed(2)}</td>
                    <td style="text-align:right; font-weight:bold;">RD$ ${g.montoTotal.toFixed(2)}</td>
                </tr>`
                )
                .join('');

            const win = window.open('', '_blank');
            if (win) {
                win.document.write(`
                    <html>
                        <head>
                            <title>PRE-REPORTE DGII FORMATO 606 - JR TECHNOLOGY</title>
                            <style>
                                body { font-family: Arial, sans-serif; padding: 28px; color: #0F172A; }
                                h2 { margin-bottom: 4px; }
                                table { width: 100%; border-collapse: collapse; margin-top: 18px; }
                                th { background: #0F172A; color: #FFF; padding: 10px; font-size: 11px; text-align: left; }
                                td { padding: 9px; border-bottom: 1px solid #CBD5E1; font-size: 12px; }
                            </style>
                        </head>
                        <body>
                            <h2>JR TECHNOLOGY CORP - PRE-ENVÍO FORMATO 606 (DGII)</h2>
                            <p>Periodo Fiscal: ${NOMBRES_MESES[mesActual].toUpperCase()} ${anioActual}</p>
                            <table>
                                <thead>
                                    <tr>
                                        <th>RNC / Cédula</th>
                                        <th>NCF / e-CF</th>
                                        <th>Tipo Bienes y Servicios (606)</th>
                                        <th>Fecha Comprobante</th>
                                        <th>Proveedor / Concepto</th>
                                        <th>Monto Facturado</th>
                                        <th>ITBIS Facturado</th>
                                        <th>Total</th>
                                    </tr>
                                </thead>
                                <tbody>${filas}</tbody>
                            </table>
                            <script>window.print();</script>
                        </body>
                    </html>
                `);
                win.document.close();
            }
        }
    };

    const prefijoMesActivo = `${anioActual}-${String(mesActual + 1).padStart(2, '0')}`;
    const gastosDelMes = gastos.filter((g) => g.fechaISO.startsWith(prefijoMesActivo));

    const gastosFiltrados = gastosDelMes.filter((g) => {
        if (diaSeleccionadoISO && g.fechaISO !== diaSeleccionadoISO) return false;
        if (vistaFiltro === 'CONDOMINIO') return g.ambito === 'CONDOMINIO';
        if (vistaFiltro === 'EMPRESA') return g.ambito === 'EMPRESA';
        return true;
    });

    const totalCondominios = gastosDelMes
        .filter((g) => g.ambito === 'CONDOMINIO')
        .reduce((acc, g) => acc + g.montoTotal, 0);

    const totalEmpresa = gastosDelMes
        .filter((g) => g.ambito === 'EMPRESA')
        .reduce((acc, g) => acc + g.montoTotal, 0);

    const totalFuturoPorPagar = gastosDelMes
        .filter((g) => g.estado === 'PROGRAMADO_FUTURO')
        .reduce((acc, g) => acc + g.montoTotal, 0);

    const totalItbisAdelantado = gastosDelMes.reduce((acc, g) => acc + g.itbis, 0);

    const celdasCalendario = construirDiasCalendario();

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {/* CABECERA PRINCIPAL */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.pageTitle}>Calendario de Gastos, Servicios y DGII (606)</Text>
                    <Text style={styles.pageSub}>
                        Programa pagos de luz, agua, seguridad y futuras reparaciones de condominios, más combustible, promo y local de la empresa.
                    </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                    <TouchableOpacity
                        style={styles.dgiiExportBtn}
                        onPress={exportarReporteDGII606}
                    >
                        <Feather name="download" size={15} color="#0F172A" />
                        <Text style={styles.dgiiExportTxt}>Exportar 606 (DGII)</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.newBtn}
                        onPress={() => abrirModalEnFecha()}
                    >
                        <Feather name="plus-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.newBtnText}>Programar / Registrar Pago</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* KPIs DE CONTROL FINANCIERO Y FISCAL */}
            <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLbl}>GASTOS CONDOMINIOS (LUZ/AGUA/SEG)</Text>
                    <Text style={[styles.kpiVal, { color: '#3B38F6' }]}>
                        RD$ {totalCondominios.toLocaleString()}
                    </Text>
                    <Text style={styles.kpiSub}>Servicios comunes y reparaciones</Text>
                </View>

                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLbl}>OPERACIÓN JR TECH (FLOTA/PROMO/LOCAL)</Text>
                    <Text style={[styles.kpiVal, { color: '#0F172A' }]}>
                        RD$ {totalEmpresa.toLocaleString()}
                    </Text>
                    <Text style={styles.kpiSub}>Combustible, publicidad y oficina</Text>
                </View>

                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLbl}>PAGOS FUTUROS PROGRAMADOS</Text>
                    <Text style={[styles.kpiVal, { color: '#D97706' }]}>
                        RD$ {totalFuturoPorPagar.toLocaleString()}
                    </Text>
                    <Text style={styles.kpiSub}>Compromisos pendientes del mes</Text>
                </View>

                <View style={styles.kpiCard}>
                    <Text style={styles.kpiLbl}>ITBIS DEDUCIBLE (DGII 606)</Text>
                    <Text style={[styles.kpiVal, { color: '#15803D' }]}>
                        RD$ {totalItbisAdelantado.toLocaleString()}
                    </Text>
                    <Text style={styles.kpiSub}>Crédito fiscal con NCF / e-CF</Text>
                </View>
            </View>

            {/* CONMUTADOR DE ÁMBITO */}
            <View style={styles.tabsRow}>
                {[
                    { id: 'TODOS', label: 'Todos los Pagos' },
                    { id: 'CONDOMINIO', label: '🏢 Gastos de Condominios' },
                    { id: 'EMPRESA', label: '🚀 Gastos de la Empresa (JR Tech)' },
                    { id: 'DGII_606', label: '🏛️ Vista Fiscal DGII (Formato 606)' },
                ].map((t) => (
                    <TouchableOpacity
                        key={t.id}
                        style={[styles.tabPill, vistaFiltro === t.id && styles.tabPillActive]}
                        onPress={() => setVistaFiltro(t.id as any)}
                    >
                        <Text style={[styles.tabPillTxt, vistaFiltro === t.id && { color: '#FFFFFF' }]}>
                            {t.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* ==================================================================== */}
            {/* CALENDARIO MENSUAL POR DÍA (SIN HORAS)                               */}
            {/* ==================================================================== */}
            <View style={styles.calendarCard}>
                <View style={styles.calHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={styles.calIcon}>
                            <Feather name="calendar" size={18} color="#3B38F6" />
                        </View>
                        <View>
                            <Text style={styles.calTitle}>
                                {NOMBRES_MESES[mesActual]} {anioActual}
                            </Text>
                            <Text style={styles.calSub}>
                                Toca cualquier día para ver sus pagos o programar un pago futuro (luz, agua, reparación, combustible)
                            </Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {diaSeleccionadoISO && (
                            <TouchableOpacity
                                style={styles.clearDayBtn}
                                onPress={() => setDiaSeleccionadoISO(null)}
                            >
                                <Text style={styles.clearDayTxt}>Ver Mes Completo</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.monthNavBtn} onPress={() => cambiarMes(-1)}>
                            <Feather name="chevron-left" size={16} color="#0F172A" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.monthNavBtn} onPress={() => cambiarMes(1)}>
                            <Feather name="chevron-right" size={16} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* CABECERA LUN A DOM */}
                <View style={styles.weekDaysRow}>
                    {DIAS_SEMANA_HEADER.map((d) => (
                        <View key={d} style={styles.weekDayCell}>
                            <Text style={styles.weekDayTxt}>{d}</Text>
                        </View>
                    ))}
                </View>

                {/* CUADRÍCULA DE DÍAS DEL MES */}
                <View style={styles.daysGrid}>
                    {celdasCalendario.map((celda, index) => {
                        if (!celda.dia || !celda.fechaISO) {
                            return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                        }

                        const pagosDelDia = gastosDelMes.filter((g) => {
                            if (g.fechaISO !== celda.fechaISO) return false;
                            if (vistaFiltro === 'CONDOMINIO') return g.ambito === 'CONDOMINIO';
                            if (vistaFiltro === 'EMPRESA') return g.ambito === 'EMPRESA';
                            return true;
                        });

                        const estaSeleccionado = diaSeleccionadoISO === celda.fechaISO;

                        return (
                            <TouchableOpacity
                                key={celda.fechaISO}
                                style={[
                                    styles.dayCell,
                                    estaSeleccionado && styles.dayCellSelected,
                                ]}
                                onPress={() => setDiaSeleccionadoISO(celda.fechaISO)}
                                onLongPress={() => {
                                    if (celda.fechaISO) abrirModalEnFecha(celda.fechaISO);
                                }}
                            >
                                <View style={styles.dayCellTop}>
                                    <Text
                                        style={[
                                            styles.dayNum,
                                            estaSeleccionado && { color: '#3B38F6', fontWeight: '900' },
                                        ]}
                                    >
                                        {celda.dia}
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.addMiniBtn}
                                        onPress={() => {
                                            if (celda.fechaISO) abrirModalEnFecha(celda.fechaISO);
                                        }}
                                    >
                                        <Feather name="plus" size={11} color="#64748B" />
                                    </TouchableOpacity>
                                </View>

                                {/* PÍLDORAS DE PAGOS EN ESE DÍA */}
                                <View style={{ gap: 3, marginTop: 4 }}>
                                    {pagosDelDia.map((p) => {
                                        const conf = CATEGORIAS_CONFIG[p.categoria];
                                        const esFuturo = p.estado === 'PROGRAMADO_FUTURO';
                                        return (
                                            <View
                                                key={p.id}
                                                style={[
                                                    styles.dayBadge,
                                                    {
                                                        backgroundColor: conf.bg,
                                                        borderLeftColor: esFuturo ? '#F59E0B' : '#10B981',
                                                    },
                                                ]}
                                            >
                                                <Text
                                                    style={[styles.dayBadgeTxt, { color: conf.color }]}
                                                    numberOfLines={1}
                                                >
                                                    {p.ambito === 'EMPRESA' ? '🚀 ' : '🏢 '}
                                                    {p.concepto}
                                                </Text>
                                                <Text style={styles.dayBadgeAmount}>
                                                    RD$ {p.montoTotal.toLocaleString()}
                                                </Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* ==================================================================== */}
            {/* VISTA FISCAL DGII (TABLA 606) O TARJETAS DE GASTOS                   */}
            {/* ==================================================================== */}
            {vistaFiltro === 'DGII_606' ? (
                <View style={styles.tableCard}>
                    <Text style={styles.cardTitle}>
                        Libro de Compras y Gastos - Pre-Formato 606 DGII ({gastosFiltrados.length} comprobantes)
                    </Text>
                    <Text style={styles.cardSub}>
                        Estructura lista con RNC, NCF / e-CF, Clasificación de Costos 606 e ITBIS para declaración mensual
                    </Text>

                    <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 12 }}>
                        <View style={{ minWidth: 960 }}>
                            <View style={styles.thRow}>
                                <Text style={[styles.th, { width: 110 }]}>RNC / CÉDULA</Text>
                                <Text style={[styles.th, { width: 130 }]}>NCF / e-CF</Text>
                                <Text style={[styles.th, { width: 230 }]}>TIPO BIENES Y SERVICIOS (606)</Text>
                                <Text style={[styles.th, { width: 190 }]}>PROVEEDOR / CONCEPTO</Text>
                                <Text style={[styles.th, { width: 95 }]}>FECHA</Text>
                                <Text style={[styles.th, { width: 100, textAlign: 'right' }]}>SUBTOTAL</Text>
                                <Text style={[styles.th, { width: 90, textAlign: 'right' }]}>ITBIS (18%)</Text>
                                <Text style={[styles.th, { width: 110, textAlign: 'right' }]}>TOTAL</Text>
                            </View>

                            {gastosFiltrados.map((g) => (
                                <View key={g.id} style={styles.trRow}>
                                    <Text style={[styles.td, { width: 110 }]}>{g.rncProveedor}</Text>
                                    <Text style={[styles.tdBold, { width: 130, color: '#3B38F6' }]}>{g.ncf}</Text>
                                    <Text style={[styles.td, { width: 230 }]} numberOfLines={1}>{g.tipo606}</Text>
                                    <Text style={[styles.td, { width: 190 }]} numberOfLines={1}>
                                        {g.proveedor} • {g.concepto}
                                    </Text>
                                    <Text style={[styles.td, { width: 95 }]}>{g.fechaISO}</Text>
                                    <Text style={[styles.td, { width: 100, textAlign: 'right' }]}>
                                        RD$ {g.subtotal.toLocaleString()}
                                    </Text>
                                    <Text style={[styles.td, { width: 90, textAlign: 'right', color: '#15803D', fontWeight: '700' }]}>
                                        RD$ {g.itbis.toLocaleString()}
                                    </Text>
                                    <Text style={[styles.tdBold, { width: 110, textAlign: 'right' }]}>
                                        RD$ {g.montoTotal.toLocaleString()}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            ) : (
                <View style={{ gap: 12 }}>
                    <Text style={styles.sectionSubTitle}>
                        {diaSeleccionadoISO
                            ? `PAGOS DEL DÍA ${diaSeleccionadoISO} (${gastosFiltrados.length})`
                            : `CRONOGRAMA DE PAGOS DEL MES (${gastosFiltrados.length})`}
                    </Text>

                    {gastosFiltrados.map((g) => {
                        const conf = CATEGORIAS_CONFIG[g.categoria];
                        const esFuturo = g.estado === 'PROGRAMADO_FUTURO';
                        return (
                            <View key={g.id} style={styles.expenseCard}>
                                <View style={styles.expTop}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                                        <View style={[styles.expIconBox, { backgroundColor: conf.bg }]}>
                                            <Feather name={conf.icon as any} size={18} color={conf.color} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                                <Text style={styles.expTitle}>{g.concepto}</Text>
                                                <View
                                                    style={[
                                                        styles.scopeBadge,
                                                        g.ambito === 'EMPRESA'
                                                            ? { backgroundColor: '#0F172A' }
                                                            : { backgroundColor: '#EEF2FF' },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.scopeBadgeTxt,
                                                            g.ambito === 'EMPRESA'
                                                                ? { color: '#FFFFFF' }
                                                                : { color: '#3B38F6' },
                                                        ]}
                                                    >
                                                        {g.ambito === 'EMPRESA' ? 'JR TECH CORPORATIVO' : g.entidadDestino}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.expMeta}>
                                                📅 Fecha: {g.fechaISO} • Proveedor: {g.proveedor} • RNC: {g.rncProveedor} • NCF: {g.ncf}
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                        <Text style={styles.expAmount}>RD$ {g.montoTotal.toLocaleString()}</Text>
                                        {esFuturo ? (
                                            <TouchableOpacity
                                                style={styles.payExecuteBtn}
                                                onPress={() => marcarComoPagado(g.id)}
                                            >
                                                <Feather name="check-circle" size={13} color="#FFFFFF" />
                                                <Text style={styles.payExecuteTxt}>Ejecutar Pago Ahora</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <View style={styles.paidPill}>
                                                <Text style={styles.paidPillTxt}>✓ PAGADO ({g.metodoPago})</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        );
                    })}
                </View>
            )}

            {/* ==================================================================== */}
            {/* MODAL PARA REGISTRAR O PROGRAMAR GASTO FUTURO / DGII                 */}
            {/* ==================================================================== */}
            <Modal
                visible={modalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.backdrop}>
                    <View style={styles.modalCard}>
                        {/* CABECERA FIJA */}
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Registrar o Programar Pago en Calendario</Text>
                                <Text style={styles.modalSub}>Fecha en calendario: {fechaFormISO}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <Feather name="x" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* CUERPO SCROLLABLE */}
                        <ScrollView style={{ flexGrow: 0 }} showsVerticalScrollIndicator={true}>
                            <Text style={styles.label}>1. ¿A quién pertenece este gasto?</Text>
                            <View style={styles.pillsWrap}>
                                <TouchableOpacity
                                    style={[styles.choicePill, ambitoForm === 'CONDOMINIO' && styles.choicePillActive]}
                                    onPress={() => {
                                        setAmbitoForm('CONDOMINIO');
                                        setEntidadForm('Residencial Santos I');
                                        setCategoriaForm('LUZ_SERVICIO');
                                    }}
                                >
                                    <Text style={[styles.choiceTxt, ambitoForm === 'CONDOMINIO' && { color: '#FFFFFF' }]}>
                                        🏢 Condominio / Residencial
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.choicePill, ambitoForm === 'EMPRESA' && styles.choicePillActive]}
                                    onPress={() => {
                                        setAmbitoForm('EMPRESA');
                                        setEntidadForm('JR Technology (Corporativo)');
                                        setCategoriaForm('COMBUSTIBLE_VEHICULOS');
                                    }}
                                >
                                    <Text style={[styles.choiceTxt, ambitoForm === 'EMPRESA' && { color: '#FFFFFF' }]}>
                                        🚀 Empresa JR Technology
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {ambitoForm === 'CONDOMINIO' && (
                                <>
                                    <Text style={styles.label}>Seleccionar Residencial</Text>
                                    <View style={styles.pillsWrap}>
                                        {['Residencial Santos I', 'Residencial Las Acacias', 'Torre Mirador'].map((r) => (
                                            <TouchableOpacity
                                                key={r}
                                                style={[styles.choicePill, entidadForm === r && styles.choicePillActive]}
                                                onPress={() => setEntidadForm(r)}
                                            >
                                                <Text style={[styles.choiceTxt, entidadForm === r && { color: '#FFFFFF' }]}>
                                                    {r}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            <Text style={styles.label}>2. Categoría del Servicio o Pago</Text>
                            <View style={styles.pillsWrap}>
                                {(Object.keys(CATEGORIAS_CONFIG) as CategoriaGasto[]).map((catKey) => (
                                    <TouchableOpacity
                                        key={catKey}
                                        style={[
                                            styles.choicePill,
                                            categoriaForm === catKey && styles.choicePillActive,
                                        ]}
                                        onPress={() => setCategoriaForm(catKey)}
                                    >
                                        <Text
                                            style={[
                                                styles.choiceTxt,
                                                categoriaForm === catKey && { color: '#FFFFFF' },
                                            ]}
                                        >
                                            {CATEGORIAS_CONFIG[catKey].label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Fecha del Pago (YYYY-MM-DD)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={fechaFormISO}
                                        onChangeText={setFechaFormISO}
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Estado del Pago</Text>
                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                        <TouchableOpacity
                                            style={[
                                                styles.choicePill,
                                                { flex: 1, alignItems: 'center' },
                                                estadoForm === 'PROGRAMADO_FUTURO' && styles.choicePillActive,
                                            ]}
                                            onPress={() => setEstadoForm('PROGRAMADO_FUTURO')}
                                        >
                                            <Text
                                                style={[
                                                    styles.choiceTxt,
                                                    estadoForm === 'PROGRAMADO_FUTURO' && { color: '#FFFFFF' },
                                                ]}
                                            >
                                                Futuro
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[
                                                styles.choicePill,
                                                { flex: 1, alignItems: 'center' },
                                                estadoForm === 'PAGADO' && styles.choicePillActive,
                                            ]}
                                            onPress={() => setEstadoForm('PAGADO')}
                                        >
                                            <Text
                                                style={[
                                                    styles.choiceTxt,
                                                    estadoForm === 'PAGADO' && { color: '#FFFFFF' },
                                                ]}
                                            >
                                                Pagado
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.label}>Concepto / Descripción Manual</Text>
                            <TextInput
                                style={styles.input}
                                value={conceptoForm}
                                onChangeText={setConceptoForm}
                                placeholder="Ej: Pago de luz escalera, Gasolina camión, Reparación portón..."
                            />

                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.label}>Monto Subtotal (RD$)</Text>
                                    <TextInput
                                        style={styles.input}
                                        keyboardType="numeric"
                                        value={subtotalForm}
                                        onChangeText={setSubtotalForm}
                                        placeholder="Ej: 3500"
                                    />
                                </View>
                                <View style={{ flex: 1, justifyContent: 'center' }}>
                                    <Text style={styles.label}>¿Lleva ITBIS 18% (DGII)?</Text>
                                    <TouchableOpacity
                                        style={[
                                            styles.choicePill,
                                            aplicaItbis && { backgroundColor: '#15803D', borderColor: '#15803D' },
                                        ]}
                                        onPress={() => setAplicaItbis(!aplicaItbis)}
                                    >
                                        <Text style={[styles.choiceTxt, aplicaItbis && { color: '#FFFFFF' }]}>
                                            {aplicaItbis ? '✓ Sí, sumar 18% ITBIS' : 'Exento / Sin ITBIS'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* DATOS FISCALES PARA FUTURO ENVÍO A LA DGII */}
                            <Text style={[styles.label, { color: '#3B38F6', marginTop: 4 }]}>
                                Datos Fiscales DGII (Opcionales ahora, listos para Formato 606 / e-CF)
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 10 }}>
                                <View style={{ flex: 1 }}>
                                    <TextInput
                                        style={styles.input}
                                        value={proveedorForm}
                                        onChangeText={setProveedorForm}
                                        placeholder="Nombre Proveedor"
                                    />
                                </View>
                                <View style={{ flex: 0.8 }}>
                                    <TextInput
                                        style={styles.input}
                                        value={rncForm}
                                        onChangeText={setRncForm}
                                        placeholder="RNC / Cédula"
                                    />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <TextInput
                                        style={styles.input}
                                        value={ncfForm}
                                        onChangeText={setNcfForm}
                                        placeholder="NCF (B01 / E31)"
                                    />
                                </View>
                            </View>
                        </ScrollView>

                        {/* PIE FIJO */}
                        <View style={styles.modalFooter}>
                            <TouchableOpacity
                                style={styles.cancelBtn}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelTxt}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={guardarGasto}>
                                <Feather name="check" size={16} color="#FFFFFF" />
                                <Text style={styles.saveTxt}>Guardar en Calendario</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    content: { padding: 24, paddingBottom: 48, gap: 18 },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    pageTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A' },
    pageSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
    newBtn: {
        backgroundColor: '#3B38F6',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    newBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    dgiiExportBtn: {
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    dgiiExportTxt: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
    kpiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    kpiCard: {
        flex: 1,
        minWidth: 210,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    kpiLbl: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.4 },
    kpiVal: { fontSize: 21, fontWeight: '800', marginVertical: 4 },
    kpiSub: { fontSize: 11, color: '#94A3B8' },
    tabsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tabPill: {
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    tabPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    tabPillTxt: { fontSize: 12, fontWeight: '800', color: '#475569' },

    /* CALENDARIO POR DÍA */
    calendarCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    calHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 14,
    },
    calIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    calTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    calSub: { fontSize: 12, color: '#64748B' },
    monthNavBtn: {
        width: 34,
        height: 34,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    clearDayBtn: {
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
    },
    clearDayTxt: { color: '#3B38F6', fontSize: 11, fontWeight: '800' },
    weekDaysRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderTopLeftRadius: 10,
        borderTopRightRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    weekDayCell: { flex: 1, paddingVertical: 8, alignItems: 'center' },
    weekDayTxt: { fontSize: 11, fontWeight: '800', color: '#475569' },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        borderLeftWidth: 1,
        borderTopWidth: 1,
        borderColor: '#E2E8F0',
    },
    dayCellEmpty: {
        width: '14.285%',
        minHeight: 88,
        backgroundColor: '#F8FAFC',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
    },
    dayCell: {
        width: '14.285%',
        minHeight: 88,
        backgroundColor: '#FFFFFF',
        padding: 6,
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
    },
    dayCellSelected: {
        backgroundColor: '#F0F7FF',
        borderColor: '#3B38F6',
        borderWidth: 1.5,
    },
    dayCellTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    dayNum: { fontSize: 12, fontWeight: '700', color: '#334155' },
    addMiniBtn: {
        width: 18,
        height: 18,
        borderRadius: 4,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayBadge: {
        borderRadius: 4,
        paddingHorizontal: 5,
        paddingVertical: 3,
        borderLeftWidth: 3,
    },
    dayBadgeTxt: { fontSize: 9, fontWeight: '800' },
    dayBadgeAmount: { fontSize: 9, fontWeight: '700', color: '#0F172A' },

    /* TARJETAS Y TABLA 606 */
    sectionSubTitle: { fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.6 },
    expenseCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    expTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    expIconBox: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    expTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
    scopeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    scopeBadgeTxt: { fontSize: 10, fontWeight: '800' },
    expMeta: { fontSize: 12, color: '#64748B', marginTop: 4 },
    expAmount: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    payExecuteBtn: {
        backgroundColor: '#15803D',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    payExecuteTxt: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
    paidPill: { backgroundColor: '#DCFCE7', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    paidPillTxt: { color: '#15803D', fontSize: 10, fontWeight: '800' },
    tableCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    cardTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
    cardSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
    thRow: {
        flexDirection: 'row',
        backgroundColor: '#0F172A',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    th: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
    trRow: {
        flexDirection: 'row',
        paddingVertical: 11,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    td: { fontSize: 12, color: '#334155' },
    tdBold: { fontSize: 12, fontWeight: '800', color: '#0F172A' },

    /* MODAL */
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 540,
        maxHeight: '88%',
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        marginBottom: 12,
    },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    modalSub: { fontSize: 12, color: '#3B38F6', fontWeight: '700', marginTop: 2 },
    label: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 },
    pillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    choicePill: {
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    choicePillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    choiceTxt: { fontSize: 11, fontWeight: '800', color: '#475569' },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        height: 40,
        paddingHorizontal: 12,
        fontSize: 13,
        marginBottom: 10,
        outlineStyle: 'none',
    } as any,
    modalFooter: {
        flexDirection: 'row',
        gap: 10,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        marginTop: 8,
    },
    cancelBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
    },
    cancelTxt: { fontSize: 13, fontWeight: '700', color: '#475569' },
    saveBtn: {
        flex: 1.5,
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#3B38F6',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    saveTxt: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
});