import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';

// ============================================================================
// FECHAS
// Se construye la fecha usando hora local para evitar cambios de día causados
// por convertir medianoche local a UTC con toISOString().
// ============================================================================
export const obtenerFechaISOSemana = (diaOffset: number): string => {
    const hoy = new Date();
    const diasDesdeLunes = (hoy.getDay() + 6) % 7;
    const fecha = new Date(
        hoy.getFullYear(),
        hoy.getMonth(),
        hoy.getDate() - diasDesdeLunes + diaOffset
    );

    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
};

// ============================================================================
// MODELOS
// ============================================================================
export interface EmpleadoEmpresa {
    id: string;
    nombre: string;
    cedula: string;
    telefono: string;
    username: string;
    password?: string;
    rol: 'MECANICO' | 'MANTENIMIENTO' | 'SUPERVISOR' | 'ELECTRICISTA';
    rolSistema: 'EMPLEADO_CAMPO' | 'SUPERVISOR' | 'ADMIN_RESIDENCIAL' | 'MASTER_ADMIN';
    permisos: string[];
    activoSistema: boolean;
    banco: string;
    cuentaBanco: string;
    tarifaBase: number;
    saldoBilletera: number;
    solicitoCobroHoy: boolean;
    trabajosCompletados: number;
    estado: 'EN_CAMPO' | 'DISPONIBLE' | 'INACTIVO';
}

export interface ReservaTrabajo {
    id: string;
    codigo: string;
    residencial: string;
    idEmpleado: string;
    nombreEmpleado: string;
    rolEmpleado: string;
    tipoServicio: 'AVERIA_MECANICA' | 'LIMPIEZA' | 'SUPERVISION' | 'ELECTRICIDAD';
    titulo: string;
    descripcion: string;
    fechaISO: string;
    hora: string;
    fechaHora: string;
    pagoManoObra: number;
    gastoMateriales: number;
    checkInGps: boolean;
    evidenciaFotos: boolean;
    estado: 'PENDIENTE' | 'EN_PROCESO' | 'VALIDADO_SUPERVISOR' | 'PAGADO';
}

export interface HistorialPagoNomina {
    id: string;
    fecha: string;
    nombreEmpleado: string;
    rol: string;
    banco: string;
    montoManoObra: number;
    reembolsoMateriales: number;
    totalPagado: number;
    referencia: string;
}

// ============================================================================
// DATOS DE DEMOSTRACIÓN
// Sustituir estos arreglos por la información recibida desde tu API empresarial.
// ============================================================================
let empleadosGlobal: EmpleadoEmpresa[] = [
    {
        id: 'EMP-1',
        nombre: 'Carlos Manuel Rodríguez',
        cedula: '031-0492819-2',
        telefono: '809-555-0192',
        username: 'carlos_mec',
        password: '123456',
        rol: 'MECANICO',
        rolSistema: 'EMPLEADO_CAMPO',
        permisos: ['App Campo', 'Reservas'],
        activoSistema: true,
        banco: 'Banreservas',
        cuentaBanco: '960-112938-4',
        tarifaBase: 1200,
        saldoBilletera: 2750,
        solicitoCobroHoy: true,
        trabajosCompletados: 34,
        estado: 'EN_CAMPO',
    },
    {
        id: 'EMP-2',
        nombre: 'Pedro Antonio Méndez',
        cedula: '031-0883712-1',
        telefono: '829-441-9011',
        username: 'pedro_mant',
        password: '123456',
        rol: 'MANTENIMIENTO',
        rolSistema: 'EMPLEADO_CAMPO',
        permisos: ['App Campo'],
        activoSistema: true,
        banco: 'Banco BHD',
        cuentaBanco: '104-883920-1',
        tarifaBase: 700,
        saldoBilletera: 1400,
        solicitoCobroHoy: true,
        trabajosCompletados: 58,
        estado: 'EN_CAMPO',
    },
    {
        id: 'EMP-3',
        nombre: 'Ing. Miguel Ángel Tavárez',
        cedula: '031-0192834-5',
        telefono: '809-882-3310',
        username: 'miguel_sup',
        password: 'admin123',
        rol: 'SUPERVISOR',
        rolSistema: 'SUPERVISOR',
        permisos: ['Residenciales', 'Reservas', 'App Campo', 'Auditoría'],
        activoSistema: true,
        banco: 'Banco Popular',
        cuentaBanco: '789-223109-8',
        tarifaBase: 1000,
        saldoBilletera: 1000,
        solicitoCobroHoy: false,
        trabajosCompletados: 41,
        estado: 'DISPONIBLE',
    },
];

let reservasGlobal: ReservaTrabajo[] = [
    {
        id: '1',
        codigo: 'ORD-901',
        residencial: 'Residencial Santos I',
        idEmpleado: 'EMP-1',
        nombreEmpleado: 'Carlos Manuel Rodríguez',
        rolEmpleado: 'MECANICO',
        tipoServicio: 'AVERIA_MECANICA',
        titulo: 'Reparación de bomba cisterna · Bloque B',
        descripcion: 'Cambio de sello mecánico y ajuste de presostato.',
        fechaISO: obtenerFechaISOSemana(0),
        hora: '09:00',
        fechaHora: `${obtenerFechaISOSemana(0)} • 09:00`,
        pagoManoObra: 1200,
        gastoMateriales: 350,
        checkInGps: true,
        evidenciaFotos: true,
        estado: 'VALIDADO_SUPERVISOR',
    },
    {
        id: '2',
        codigo: 'ORD-902',
        residencial: 'Residencial Santos I',
        idEmpleado: 'EMP-2',
        nombreEmpleado: 'Pedro Antonio Méndez',
        rolEmpleado: 'MANTENIMIENTO',
        tipoServicio: 'LIMPIEZA',
        titulo: 'Limpieza de áreas comunes y escaleras',
        descripcion: 'Higienización de pasillos, torres A y B y cuarto de basura.',
        fechaISO: obtenerFechaISOSemana(2),
        hora: '10:00',
        fechaHora: `${obtenerFechaISOSemana(2)} • 10:00`,
        pagoManoObra: 700,
        gastoMateriales: 0,
        checkInGps: true,
        evidenciaFotos: false,
        estado: 'EN_PROCESO',
    },
    {
        id: '3',
        codigo: 'ORD-903',
        residencial: 'Residencial Las Acacias',
        idEmpleado: 'EMP-3',
        nombreEmpleado: 'Ing. Miguel Ángel Tavárez',
        rolEmpleado: 'SUPERVISOR',
        tipoServicio: 'SUPERVISION',
        titulo: 'Inspección mensual de medidores de gas',
        descripcion: 'Auditoría de lecturas y verificación de válvulas.',
        fechaISO: obtenerFechaISOSemana(3),
        hora: '14:00',
        fechaHora: `${obtenerFechaISOSemana(3)} • 14:00`,
        pagoManoObra: 1000,
        gastoMateriales: 0,
        checkInGps: false,
        evidenciaFotos: false,
        estado: 'PENDIENTE',
    },
];

let pagosNominaGlobal: HistorialPagoNomina[] = [
    {
        id: 'PAG-101',
        fecha: '28/10/2026',
        nombreEmpleado: 'Carlos Manuel Rodríguez',
        rol: 'MECANICO',
        banco: 'Banreservas • 960-112938-4',
        montoManoObra: 2400,
        reembolsoMateriales: 500,
        totalPagado: 2900,
        referencia: 'TRF-9928172',
    },
];

let listeners: Array<() => void> = [];

// ============================================================================
// STORE LOCAL DE DEMOSTRACIÓN
// Mantiene las operaciones existentes para que las demás pantallas sigan
// sincronizándose mediante subscribe() y notify(). En producción, reemplazar
// por llamadas a la API y estado de servidor.
// ============================================================================
export const EnterpriseStore = {
    getEmpleados: () => empleadosGlobal,
    getReservas: () => reservasGlobal,
    getHistorialNomina: () => pagosNominaGlobal,
    notify: () => listeners.forEach((listener) => listener()),
    subscribe: (listener: () => void) => {
        listeners.push(listener);
        return () => {
            listeners = listeners.filter((item) => item !== listener);
        };
    },
    agregarEmpleado: (emp: Partial<EmpleadoEmpresa> & { id: string; nombre: string; cedula: string; rol: any }) => {
        const nuevo: EmpleadoEmpresa = {
            telefono: '809-000-0000',
            username: `${emp.nombre.toLowerCase().split(' ')[0]}_${Math.floor(10 + Math.random() * 89)}`,
            password: '123456',
            rolSistema: emp.rol === 'SUPERVISOR' ? 'SUPERVISOR' : 'EMPLEADO_CAMPO',
            permisos: emp.rol === 'SUPERVISOR' ? ['Residenciales', 'Reservas', 'App Campo'] : ['App Campo'],
            activoSistema: true,
            banco: 'Banreservas',
            cuentaBanco: '000-000000-0',
            tarifaBase: 800,
            saldoBilletera: 0,
            solicitoCobroHoy: false,
            trabajosCompletados: 0,
            estado: 'DISPONIBLE',
            ...emp,
        };
        empleadosGlobal = [nuevo, ...empleadosGlobal];
        EnterpriseStore.notify();
    },
    actualizarEmpleado: (id: string, data: Partial<EmpleadoEmpresa>) => {
        empleadosGlobal = empleadosGlobal.map((empleado) =>
            empleado.id === id ? { ...empleado, ...data } : empleado
        );
        EnterpriseStore.notify();
    },
    eliminarEmpleado: (id: string) => {
        empleadosGlobal = empleadosGlobal.filter((empleado) => empleado.id !== id);
        EnterpriseStore.notify();
    },
    agregarReserva: (reserva: ReservaTrabajo) => {
        reservasGlobal = [reserva, ...reservasGlobal];
        EnterpriseStore.notify();
    },
    validarReserva: (idReserva: string) => {
        const target = reservasGlobal.find((reserva) => reserva.id === idReserva);
        if (!target || target.estado === 'VALIDADO_SUPERVISOR' || target.estado === 'PAGADO') return;

        reservasGlobal = reservasGlobal.map((reserva) =>
            reserva.id === idReserva
                ? { ...reserva, estado: 'VALIDADO_SUPERVISOR', checkInGps: true, evidenciaFotos: true }
                : reserva
        );

        const totalSumar = target.pagoManoObra + target.gastoMateriales;
        empleadosGlobal = empleadosGlobal.map((empleado) =>
            empleado.id === target.idEmpleado
                ? {
                    ...empleado,
                    saldoBilletera: empleado.saldoBilletera + totalSumar,
                    trabajosCompletados: empleado.trabajosCompletados + 1,
                    solicitoCobroHoy: true,
                }
                : empleado
        );
        EnterpriseStore.notify();
    },
    liquidarEmpleado: (idEmpleado: string) => {
        const empleado = empleadosGlobal.find((item) => item.id === idEmpleado);
        if (!empleado || empleado.saldoBilletera <= 0) return;

        const nuevoPago: HistorialPagoNomina = {
            id: `PAG-${Date.now()}`,
            fecha: new Date().toLocaleDateString('es-DO'),
            nombreEmpleado: empleado.nombre,
            rol: empleado.rol,
            banco: `${empleado.banco} • ${empleado.cuentaBanco}`,
            montoManoObra: empleado.saldoBilletera,
            reembolsoMateriales: 0,
            totalPagado: empleado.saldoBilletera,
            referencia: `TRF-${Math.floor(100000 + Math.random() * 900000)}`,
        };

        pagosNominaGlobal = [nuevoPago, ...pagosNominaGlobal];
        empleadosGlobal = empleadosGlobal.map((item) =>
            item.id === idEmpleado ? { ...item, saldoBilletera: 0, solicitoCobroHoy: false } : item
        );
        reservasGlobal = reservasGlobal.map((reserva) =>
            reserva.idEmpleado === idEmpleado && reserva.estado === 'VALIDADO_SUPERVISOR'
                ? { ...reserva, estado: 'PAGADO' }
                : reserva
        );
        EnterpriseStore.notify();
    },
};

// ============================================================================
// UTILIDADES DE PRESENTACIÓN
// ============================================================================
type FiltroOrden = 'TODAS' | 'PENDIENTE' | 'EN_PROCESO' | 'VALIDADO_SUPERVISOR';

const formatearDinero = (monto: number): string =>
    `RD$ ${Math.round(monto).toLocaleString('en-US')}`;

const formatearFechaActual = (): string =>
    new Date().toLocaleDateString('es-DO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

const obtenerSaludo = (): string => {
    const hora = new Date().getHours();
    if (hora < 12) return 'Buenos días';
    if (hora < 19) return 'Buenas tardes';
    return 'Buenas noches';
};

const nombreRol = (rol: string): string => {
    const roles: Record<string, string> = {
        MECANICO: 'Mecánico',
        MANTENIMIENTO: 'Mantenimiento',
        SUPERVISOR: 'Supervisor',
        ELECTRICISTA: 'Electricista',
    };
    return roles[rol] ?? rol.replace(/_/g, ' ');
};

const nombreEstado = (estado: string): string => {
    const estados: Record<string, string> = {
        PENDIENTE: 'Pendiente',
        EN_PROCESO: 'En proceso',
        VALIDADO_SUPERVISOR: 'Validado',
        PAGADO: 'Pagado',
    };
    return estados[estado] ?? estado.replace(/_/g, ' ');
};

const cuentaEnmascarada = (cuenta: string): string => {
    const ultimos = cuenta.replace(/\D/g, '').slice(-4);
    return ultimos ? `•••• ${ultimos}` : 'Cuenta registrada';
};

// ============================================================================
// COMPONENTES VISUALES
// ============================================================================
interface MetricCardProps {
    label: string;
    value: string;
    detail: string;
    icon: React.ReactNode;
    accent: string;
    iconBackground: string;
}

function MetricCard({ label, value, detail, icon, accent, iconBackground }: MetricCardProps) {
    return (
        <View style={styles.metricCard}>
            <View style={styles.metricTopRow}>
                <View style={[styles.metricIcon, { backgroundColor: iconBackground }]}>{icon}</View>
                <View style={[styles.metricAccent, { backgroundColor: accent }]} />
            </View>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={[styles.metricValue, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
                {value}
            </Text>
            <Text style={styles.metricDetail}>{detail}</Text>
        </View>
    );
}

function SectionHeader({
                           title,
                           subtitle,
                           actionLabel,
                           onAction,
                       }: {
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    return (
        <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderCopy}>
                <Text style={styles.cardTitle}>{title}</Text>
                {!!subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
            </View>
            {!!actionLabel && !!onAction && (
                <TouchableOpacity style={styles.textAction} onPress={onAction} activeOpacity={0.75}>
                    <Text style={styles.textActionLabel}>{actionLabel}</Text>
                    <Feather name="arrow-up-right" size={14} color="#4659D8" />
                </TouchableOpacity>
            )}
        </View>
    );
}

function StatusBadge({ status }: { status: string }) {
    const palette: Record<string, { background: string; text: string; dot: string }> = {
        PENDIENTE: { background: '#FFF6E5', text: '#A15C00', dot: '#E99A22' },
        EN_PROCESO: { background: '#EAF1FF', text: '#3159B8', dot: '#4F79DF' },
        VALIDADO_SUPERVISOR: { background: '#E8F7EF', text: '#187448', dot: '#27A36A' },
        PAGADO: { background: '#F0F2F5', text: '#5E6878', dot: '#8993A1' },
    };
    const colors = palette[status] ?? palette.PENDIENTE;

    return (
        <View style={[styles.statusBadge, { backgroundColor: colors.background }]}>
            <View style={[styles.statusDot, { backgroundColor: colors.dot }]} />
            <Text style={[styles.statusBadgeText, { color: colors.text }]}>{nombreEstado(status)}</Text>
        </View>
    );
}

function MiniWeekChart({ reservas }: { reservas: ReservaTrabajo[] }) {
    const data = Array.from({ length: 7 }, (_, index) => {
        const fecha = obtenerFechaISOSemana(index);
        const cantidad = reservas.filter((reserva) => reserva.fechaISO === fecha).length;
        const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
        return { fecha, cantidad, label: labels[index] };
    });
    const maximo = Math.max(...data.map((item) => item.cantidad), 1);
    const total = data.reduce((sum, item) => sum + item.cantidad, 0);

    return (
        <View style={styles.card}>
            <SectionHeader
                title="Carga de trabajo semanal"
                subtitle="Órdenes programadas por día, según el calendario de operaciones."
            />
            <View style={styles.chartSummaryRow}>
                <Text style={styles.chartTotal}>{total}</Text>
                <Text style={styles.chartSummaryText}>órdenes esta semana</Text>
            </View>
            <View style={styles.chartBars}>
                {data.map((item) => {
                    const height = item.cantidad === 0 ? 5 : Math.max(12, (item.cantidad / maximo) * 76);
                    const esHoy = item.fecha === obtenerFechaISOSemana((new Date().getDay() + 6) % 7);
                    return (
                        <View key={item.fecha} style={styles.chartColumn}>
                            <Text style={styles.chartCount}>{item.cantidad || ''}</Text>
                            <View style={styles.chartTrack}>
                                <View
                                    style={[
                                        styles.chartBar,
                                        { height, backgroundColor: esHoy ? '#4659D8' : '#A9B6F5' },
                                    ]}
                                />
                            </View>
                            <Text style={[styles.chartDay, esHoy && styles.chartDayToday]}>{item.label}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// ============================================================================
// DASHBOARD EMPRESARIAL
// ============================================================================
export default function EmpresaDashboard() {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isDesktop = width >= 1120;
    const isTablet = width >= 700 && width < 1120;

    const [empleados, setEmpleados] = useState<EmpleadoEmpresa[]>(EnterpriseStore.getEmpleados());
    const [reservas, setReservas] = useState<ReservaTrabajo[]>(EnterpriseStore.getReservas());
    const [filtroOrden, setFiltroOrden] = useState<FiltroOrden>('TODAS');

    useEffect(() => {
        const unsubscribe = EnterpriseStore.subscribe(() => {
            setEmpleados([...EnterpriseStore.getEmpleados()]);
            setReservas([...EnterpriseStore.getReservas()]);
        });
        return unsubscribe;
    }, []);

    const ordenesActivas = useMemo(
        () => reservas.filter((reserva) => reserva.estado !== 'PAGADO'),
        [reservas]
    );

    const ordenesFiltradas = useMemo(
        () => filtroOrden === 'TODAS'
            ? ordenesActivas
            : ordenesActivas.filter((reserva) => reserva.estado === filtroOrden),
        [filtroOrden, ordenesActivas]
    );

    const empleadosPorCobrar = useMemo(
        () => empleados.filter((empleado) => empleado.solicitoCobroHoy && empleado.saldoBilletera > 0),
        [empleados]
    );

    const totalNominaPendiente = empleados.reduce((total, empleado) => total + empleado.saldoBilletera, 0);
    const empleadosEnCampo = empleados.filter((empleado) => empleado.estado === 'EN_CAMPO').length;
    const empleadosDisponibles = empleados.filter((empleado) => empleado.estado === 'DISPONIBLE').length;
    const empleadosInactivos = empleados.filter((empleado) => empleado.estado === 'INACTIVO').length;

    const metricWidth: `${number}%` = isDesktop ? '23.7%' : isTablet ? '48.5%' : '100%';

    const confirmarLiquidacion = (empleado: EmpleadoEmpresa) => {
        Alert.alert(
            'Confirmar liquidación',
            `Vas a registrar un pago de ${formatearDinero(empleado.saldoBilletera)} a ${empleado.nombre}. Esta acción actualizará la billetera y el historial local de nómina.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar pago',
                    onPress: () => EnterpriseStore.liquidarEmpleado(empleado.id),
                },
            ]
        );
    };

    const filtros: Array<{ key: FiltroOrden; label: string; count: number }> = [
        { key: 'TODAS', label: 'Todas', count: ordenesActivas.length },
        { key: 'PENDIENTE', label: 'Pendientes', count: ordenesActivas.filter((r) => r.estado === 'PENDIENTE').length },
        { key: 'EN_PROCESO', label: 'En proceso', count: ordenesActivas.filter((r) => r.estado === 'EN_PROCESO').length },
        { key: 'VALIDADO_SUPERVISOR', label: 'Validadas', count: ordenesActivas.filter((r) => r.estado === 'VALIDADO_SUPERVISOR').length },
    ];

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.page}>
                {/* CABECERA EJECUTIVA */}
                <View style={styles.hero}>
                    <View style={styles.heroTopLine}>
                        <View style={styles.heroBrand}>
                            <View style={styles.heroBrandIcon}>
                                <MaterialCommunityIcons name="domain" size={19} color="#FFFFFF" />
                            </View>
                            <View>
                                <Text style={styles.heroBrandName}>JR TECHNOLOGY</Text>
                                <Text style={styles.heroBrandCaption}>PLATAFORMA DE ADMINISTRACIÓN</Text>
                            </View>
                        </View>
                        <View style={styles.liveIndicator}>
                            <View style={styles.liveDot} />
                            <Text style={styles.liveText}>PANEL OPERATIVO</Text>
                        </View>
                    </View>

                    <View style={styles.heroMain}>
                        <View style={styles.heroCopy}>
                            <Text style={styles.heroEyebrow}>{obtenerSaludo().toUpperCase()}</Text>
                            <Text style={styles.heroTitle}>Tu operación, bajo control.</Text>
                            <Text style={styles.heroSubtitle}>
                                Supervisa el equipo, las órdenes de trabajo y los compromisos de pago desde un solo lugar.
                            </Text>
                            <Text style={styles.heroDate}>{formatearFechaActual()}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.heroButton}
                            onPress={() => router.push('/(empresa)/ControlReservas')}
                            activeOpacity={0.85}
                        >
                            <Feather name="plus" size={17} color="#182230" />
                            <Text style={styles.heroButtonText}>Nueva orden</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.heroFooter}>
                        <View style={styles.heroFooterItem}>
                            <Text style={styles.heroFooterValue}>{ordenesActivas.length}</Text>
                            <Text style={styles.heroFooterLabel}>Órdenes abiertas</Text>
                        </View>
                        <View style={styles.heroFooterDivider} />
                        <View style={styles.heroFooterItem}>
                            <Text style={styles.heroFooterValue}>{empleados.length}</Text>
                            <Text style={styles.heroFooterLabel}>Colaboradores</Text>
                        </View>
                        <View style={styles.heroFooterDivider} />
                        <View style={styles.heroFooterItem}>
                            <Text style={styles.heroFooterValue}>{empleadosPorCobrar.length}</Text>
                            <Text style={styles.heroFooterLabel}>Solicitudes de pago</Text>
                        </View>
                    </View>
                    <View style={styles.heroDecoration} />
                </View>

                {/* INDICADORES */}
                <View style={styles.sectionIntro}>
                    <View>
                        <Text style={styles.sectionEyebrow}>RESUMEN EJECUTIVO</Text>
                        <Text style={styles.sectionTitle}>Indicadores del negocio</Text>
                    </View>
                    <View style={styles.periodPill}>
                        <Feather name="calendar" size={13} color="#64748B" />
                        <Text style={styles.periodPillText}>Este mes</Text>
                    </View>
                </View>

                <View style={styles.metricsGrid}>
                    <View style={{ width: metricWidth }}>
                        <MetricCard
                            label="Residenciales activos"
                            value="4 condominios"
                            detail="38 unidades administradas · demo"
                            icon={<MaterialCommunityIcons name="office-building-marker" size={21} color="#4659D8" />}
                            accent="#4659D8"
                            iconBackground="#EEF0FF"
                        />
                    </View>
                    <View style={{ width: metricWidth }}>
                        <MetricCard
                            label="Facturación empresarial"
                            value={formatearDinero(84500)}
                            detail="Honorarios y servicios · demo"
                            icon={<Feather name="trending-up" size={21} color="#16835D" />}
                            accent="#16835D"
                            iconBackground="#E8F7EF"
                        />
                    </View>
                    <View style={{ width: metricWidth }}>
                        <MetricCard
                            label="Órdenes sin cerrar"
                            value={String(ordenesActivas.length)}
                            detail={`${reservas.filter((r) => r.estado === 'PENDIENTE').length} pendientes de inicio`}
                            icon={<Feather name="clipboard" size={21} color="#B77716" />}
                            accent="#B77716"
                            iconBackground="#FFF4DF"
                        />
                    </View>
                    <View style={{ width: metricWidth }}>
                        <MetricCard
                            label="Por liquidar al equipo"
                            value={formatearDinero(totalNominaPendiente)}
                            detail={`${empleadosPorCobrar.length} colaboradores solicitaron pago`}
                            icon={<Feather name="credit-card" size={21} color="#C14C55" />}
                            accent="#C14C55"
                            iconBackground="#FFF0F0"
                        />
                    </View>
                </View>

                <View style={styles.demoNotice}>
                    <Feather name="info" size={14} color="#8B6A2B" />
                    <Text style={styles.demoNoticeText}>
                        Los residenciales, unidades y facturación son datos demostrativos. Las órdenes y la nómina se calculan desde EnterpriseStore.
                    </Text>
                </View>

                {/* CONTENIDO PRINCIPAL */}
                <View style={[styles.mainGrid, isDesktop && styles.mainGridDesktop]}>
                    <View style={[styles.mainPrimary, isDesktop && styles.mainPrimaryDesktop]}>
                        {/* MONITOR DE ÓRDENES */}
                        <View style={styles.card}>
                            <SectionHeader
                                title="Centro de operaciones"
                                subtitle="Seguimiento de órdenes de trabajo y servicios asignados."
                                actionLabel="Abrir despacho"
                                onAction={() => router.push('/(empresa)/ControlReservas')}
                            />

                            <View style={styles.filterRow}>
                                {filtros.map((filtro) => {
                                    const seleccionado = filtroOrden === filtro.key;
                                    return (
                                        <TouchableOpacity
                                            key={filtro.key}
                                            style={[styles.filterChip, seleccionado && styles.filterChipActive]}
                                            onPress={() => setFiltroOrden(filtro.key)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[styles.filterChipText, seleccionado && styles.filterChipTextActive]}>
                                                {filtro.label}
                                            </Text>
                                            <Text style={[styles.filterCount, seleccionado && styles.filterCountActive]}>
                                                {filtro.count}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {ordenesFiltradas.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <View style={styles.emptyIcon}>
                                        <Feather name="check-circle" size={23} color="#16835D" />
                                    </View>
                                    <Text style={styles.emptyTitle}>No hay órdenes en esta categoría</Text>
                                    <Text style={styles.emptySubtitle}>Cuando se registren nuevas tareas, aparecerán aquí.</Text>
                                </View>
                            ) : (
                                ordenesFiltradas.map((orden, index) => (
                                    <View
                                        key={orden.id}
                                        style={[styles.orderItem, index === ordenesFiltradas.length - 1 && styles.orderItemLast]}
                                    >
                                        <View style={styles.orderMainLine}>
                                            <View style={styles.orderCodeIcon}>
                                                <Feather name="tool" size={17} color="#4659D8" />
                                            </View>
                                            <View style={styles.orderInfo}>
                                                <View style={styles.orderTitleLine}>
                                                    <Text style={styles.orderCode}>{orden.codigo}</Text>
                                                    <StatusBadge status={orden.estado} />
                                                </View>
                                                <Text style={styles.orderTitle}>{orden.titulo}</Text>
                                                <Text style={styles.orderResidential}>{orden.residencial}</Text>
                                            </View>
                                            <View style={styles.orderAmountBlock}>
                                                <Text style={styles.orderAmount}>
                                                    {formatearDinero(orden.pagoManoObra + orden.gastoMateriales)}
                                                </Text>
                                                <Text style={styles.orderAmountCaption}>Costo estimado</Text>
                                            </View>
                                        </View>

                                        <View style={styles.orderMetaRow}>
                                            <View style={styles.orderMetaItem}>
                                                <Feather name="user" size={12} color="#7B8797" />
                                                <Text style={styles.orderMetaText}>{orden.nombreEmpleado}</Text>
                                            </View>
                                            <View style={styles.orderMetaItem}>
                                                <Feather name="clock" size={12} color="#7B8797" />
                                                <Text style={styles.orderMetaText}>{orden.fechaHora}</Text>
                                            </View>
                                        </View>

                                        <View style={styles.evidenceRow}>
                                            <View style={[styles.evidenceTag, orden.checkInGps && styles.evidenceTagDone]}>
                                                <Feather name="map-pin" size={11} color={orden.checkInGps ? '#16835D' : '#A16A21'} />
                                                <Text style={[styles.evidenceText, orden.checkInGps && styles.evidenceTextDone]}>
                                                    {orden.checkInGps ? 'GPS verificado' : 'Sin check-in'}
                                                </Text>
                                            </View>
                                            <View style={[styles.evidenceTag, orden.evidenciaFotos && styles.evidenceTagDone]}>
                                                <Feather name="camera" size={11} color={orden.evidenciaFotos ? '#16835D' : '#A16A21'} />
                                                <Text style={[styles.evidenceText, orden.evidenciaFotos && styles.evidenceTextDone]}>
                                                    {orden.evidenciaFotos ? 'Evidencias cargadas' : 'Fotos pendientes'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>

                        {/* GRÁFICO DE CARGA */}
                        <MiniWeekChart reservas={reservas} />
                    </View>

                    <View style={[styles.mainSecondary, isDesktop && styles.mainSecondaryDesktop]}>
                        {/* LIQUIDACIONES */}
                        <View style={styles.card}>
                            <SectionHeader
                                title="Pagos pendientes"
                                subtitle="Colaboradores que solicitaron liquidación."
                                actionLabel="Ver nómina"
                                onAction={() => router.push('/(empresa)/Nomina')}
                            />

                            <View style={styles.payrollSummary}>
                                <View>
                                    <Text style={styles.payrollSummaryLabel}>Balance por liquidar</Text>
                                    <Text style={styles.payrollSummaryValue}>{formatearDinero(totalNominaPendiente)}</Text>
                                </View>
                                <View style={styles.payrollSummaryIcon}>
                                    <Feather name="wallet" size={20} color="#4659D8" />
                                </View>
                            </View>

                            {empleadosPorCobrar.length === 0 ? (
                                <View style={styles.emptyStateCompact}>
                                    <Feather name="check-circle" size={20} color="#16835D" />
                                    <Text style={styles.emptyCompactText}>No hay solicitudes de pago pendientes.</Text>
                                </View>
                            ) : (
                                empleadosPorCobrar.map((empleado) => (
                                    <View key={empleado.id} style={styles.payrollItem}>
                                        <View style={styles.employeeAvatar}>
                                            <Text style={styles.employeeAvatarText}>
                                                {empleado.nombre.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={styles.payrollEmployeeInfo}>
                                            <Text style={styles.payrollEmployeeName} numberOfLines={1}>{empleado.nombre}</Text>
                                            <Text style={styles.payrollEmployeeMeta}>
                                                {nombreRol(empleado.rol)} · {empleado.banco}
                                            </Text>
                                            <Text style={styles.payrollBankAccount}>{cuentaEnmascarada(empleado.cuentaBanco)}</Text>
                                        </View>
                                        <View style={styles.payrollActionColumn}>
                                            <Text style={styles.payrollAmount}>{formatearDinero(empleado.saldoBilletera)}</Text>
                                            <TouchableOpacity
                                                style={styles.payButton}
                                                onPress={() => confirmarLiquidacion(empleado)}
                                                activeOpacity={0.8}
                                            >
                                                <Feather name="check" size={13} color="#FFFFFF" />
                                                <Text style={styles.payButtonText}>Liquidar</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))
                            )}
                            <Text style={styles.payrollFootnote}>
                                Los pagos deben confirmarse contra el comprobante bancario antes de registrarlos en producción.
                            </Text>
                        </View>

                        {/* ESTADO DEL EQUIPO */}
                        <View style={styles.card}>
                            <SectionHeader
                                title="Equipo de trabajo"
                                subtitle="Disponibilidad actual de los colaboradores registrados."
                            />
                            <View style={styles.teamStatsRow}>
                                <View style={styles.teamStat}>
                                    <View style={[styles.teamStatDot, { backgroundColor: '#3B82F6' }]} />
                                    <Text style={styles.teamStatValue}>{empleadosEnCampo}</Text>
                                    <Text style={styles.teamStatLabel}>En campo</Text>
                                </View>
                                <View style={styles.teamStatDivider} />
                                <View style={styles.teamStat}>
                                    <View style={[styles.teamStatDot, { backgroundColor: '#22A06B' }]} />
                                    <Text style={styles.teamStatValue}>{empleadosDisponibles}</Text>
                                    <Text style={styles.teamStatLabel}>Disponibles</Text>
                                </View>
                                <View style={styles.teamStatDivider} />
                                <View style={styles.teamStat}>
                                    <View style={[styles.teamStatDot, { backgroundColor: '#9AA3AF' }]} />
                                    <Text style={styles.teamStatValue}>{empleadosInactivos}</Text>
                                    <Text style={styles.teamStatLabel}>Inactivos</Text>
                                </View>
                            </View>

                            {empleados.length === 0 ? (
                                <Text style={styles.teamEmptyText}>Todavía no hay colaboradores registrados.</Text>
                            ) : (
                                empleados.slice(0, 4).map((empleado, index) => (
                                    <View key={empleado.id} style={[styles.teamMember, index === Math.min(empleados.length, 4) - 1 && styles.teamMemberLast]}>
                                        <View style={styles.teamMemberAvatar}>
                                            <Text style={styles.teamMemberAvatarText}>
                                                {empleado.nombre.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                                            </Text>
                                        </View>
                                        <View style={styles.teamMemberInfo}>
                                            <Text style={styles.teamMemberName} numberOfLines={1}>{empleado.nombre}</Text>
                                            <Text style={styles.teamMemberRole}>{nombreRol(empleado.rol)}</Text>
                                        </View>
                                        <View style={styles.teamMemberStatusWrap}>
                                            <View
                                                style={[
                                                    styles.teamMemberStatusDot,
                                                    { backgroundColor: empleado.estado === 'EN_CAMPO' ? '#3B82F6' : empleado.estado === 'DISPONIBLE' ? '#22A06B' : '#9AA3AF' },
                                                ]}
                                            />
                                            <Text style={styles.teamMemberStatusText}>
                                                {empleado.estado === 'EN_CAMPO' ? 'En campo' : empleado.estado === 'DISPONIBLE' ? 'Disponible' : 'Inactivo'}
                                            </Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </View>
                </View>

                {/* ACCESOS RÁPIDOS */}
                <View style={styles.bottomSection}>
                    <View style={styles.sectionIntroCompact}>
                        <View>
                            <Text style={styles.sectionEyebrow}>ACCESOS DIRECTOS</Text>
                            <Text style={styles.sectionTitle}>Herramientas de gestión</Text>
                        </View>
                    </View>
                    <View style={styles.quickLinksGrid}>
                        <TouchableOpacity
                            style={[styles.quickLinkCard, { width: isDesktop ? '32%' : isTablet ? '48.5%' : '100%' }]}
                            onPress={() => router.push('/(empresa)/ControlReservas')}
                            activeOpacity={0.82}
                        >
                            <View style={[styles.quickLinkIcon, { backgroundColor: '#EEF0FF' }]}>
                                <Feather name="clipboard" size={19} color="#4659D8" />
                            </View>
                            <View style={styles.quickLinkCopy}>
                                <Text style={styles.quickLinkTitle}>Despacho de órdenes</Text>
                                <Text style={styles.quickLinkSubtitle}>Crear, asignar y supervisar trabajos.</Text>
                            </View>
                            <Feather name="arrow-up-right" size={17} color="#7B8797" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.quickLinkCard, { width: isDesktop ? '32%' : isTablet ? '48.5%' : '100%' }]}
                            onPress={() => router.push('/(empresa)/Nomina')}
                            activeOpacity={0.82}
                        >
                            <View style={[styles.quickLinkIcon, { backgroundColor: '#E8F7EF' }]}>
                                <Feather name="credit-card" size={19} color="#16835D" />
                            </View>
                            <View style={styles.quickLinkCopy}>
                                <Text style={styles.quickLinkTitle}>Nómina y liquidaciones</Text>
                                <Text style={styles.quickLinkSubtitle}>Consultar saldos e historial de pagos.</Text>
                            </View>
                            <Feather name="arrow-up-right" size={17} color="#7B8797" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.quickLinkCard, { width: isDesktop ? '32%' : isTablet ? '48.5%' : '100%' }]}
                            onPress={() => router.push('/(empleado)' as any)}
                            activeOpacity={0.82}
                        >
                            <View style={[styles.quickLinkIcon, { backgroundColor: '#FFF4DF' }]}>
                                <Feather name="smartphone" size={19} color="#B77716" />
                            </View>
                            <View style={styles.quickLinkCopy}>
                                <Text style={styles.quickLinkTitle}>Vista de empleado</Text>
                                <Text style={styles.quickLinkSubtitle}>Probar la experiencia del personal de campo.</Text>
                            </View>
                            <Feather name="arrow-up-right" size={17} color="#7B8797" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>JR TECHNOLOGY · PANEL EMPRESARIAL</Text>
                    <Text style={styles.footerSubtext}>Vista operativa · Los datos de ejemplo deben conectarse a la API empresarial.</Text>
                </View>
            </View>
        </ScrollView>
    );
}

// ============================================================================
// ESTILOS
// ============================================================================
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F4F6FA',
    },
    scrollContent: {
        paddingHorizontal: 18,
        paddingTop: 20,
        paddingBottom: 48,
    },
    page: {
        width: '100%',
        maxWidth: 1500,
        alignSelf: 'center',
        gap: 22,
    },

    // Hero
    hero: {
        backgroundColor: '#17243A',
        borderRadius: 22,
        padding: 24,
        overflow: 'hidden',
    },
    heroTopLine: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 12,
    },
    heroBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    heroBrandIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: '#344967',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroBrandName: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1.1,
    },
    heroBrandCaption: {
        color: '#A9B7CA',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.8,
        marginTop: 2,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: '#263750',
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: '#55D6A0',
    },
    liveText: {
        color: '#C7D4E5',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    heroMain: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 20,
        paddingTop: 28,
        paddingBottom: 24,
    },
    heroCopy: {
        flex: 1,
        minWidth: 220,
        zIndex: 1,
    },
    heroEyebrow: {
        color: '#91A7C7',
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1.5,
        marginBottom: 7,
    },
    heroTitle: {
        color: '#FFFFFF',
        fontSize: 29,
        lineHeight: 35,
        fontWeight: '800',
        letterSpacing: -0.7,
    },
    heroSubtitle: {
        color: '#C0CCDC',
        fontSize: 13,
        lineHeight: 20,
        maxWidth: 600,
        marginTop: 8,
    },
    heroDate: {
        color: '#90A2BA',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 13,
        textTransform: 'capitalize',
    },
    heroButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 17,
        paddingVertical: 12,
        borderRadius: 11,
        backgroundColor: '#DCE5FF',
        zIndex: 1,
    },
    heroButtonText: {
        color: '#182230',
        fontSize: 12,
        fontWeight: '800',
    },
    heroFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#22334D',
        borderRadius: 13,
        paddingHorizontal: 15,
        paddingVertical: 12,
        gap: 17,
        zIndex: 1,
    },
    heroFooterItem: {
        gap: 2,
    },
    heroFooterValue: {
        color: '#FFFFFF',
        fontSize: 17,
        fontWeight: '800',
    },
    heroFooterLabel: {
        color: '#AEBED2',
        fontSize: 10,
        fontWeight: '600',
    },
    heroFooterDivider: {
        width: 1,
        height: 28,
        backgroundColor: '#40536D',
    },
    heroDecoration: {
        position: 'absolute',
        right: -55,
        top: 65,
        width: 230,
        height: 230,
        borderWidth: 1,
        borderColor: 'rgba(174, 195, 230, 0.10)',
        borderRadius: 115,
    },

    // Section headings and KPI cards
    sectionIntro: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        gap: 12,
    },
    sectionIntroCompact: {
        marginBottom: 1,
    },
    sectionEyebrow: {
        color: '#7C8798',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    sectionTitle: {
        color: '#17243A',
        fontSize: 20,
        fontWeight: '800',
        letterSpacing: -0.4,
    },
    periodPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: '#E2E7EF',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 9,
    },
    periodPillText: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '700',
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 12,
    },
    metricCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E7EBF1',
        padding: 16,
        minHeight: 151,
        shadowColor: '#25344B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.035,
        shadowRadius: 8,
        elevation: 1,
    },
    metricTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 13,
    },
    metricIcon: {
        width: 39,
        height: 39,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    metricAccent: {
        width: 7,
        height: 7,
        borderRadius: 4,
        opacity: 0.8,
    },
    metricLabel: {
        color: '#788496',
        fontSize: 11,
        fontWeight: '700',
    },
    metricValue: {
        fontSize: 21,
        fontWeight: '900',
        letterSpacing: -0.5,
        marginTop: 4,
    },
    metricDetail: {
        color: '#9AA4B2',
        fontSize: 10,
        lineHeight: 15,
        marginTop: 4,
    },
    demoNotice: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#FFF9EC',
        borderWidth: 1,
        borderColor: '#F4E8C9',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        marginTop: -10,
    },
    demoNoticeText: {
        flex: 1,
        color: '#826B3D',
        fontSize: 10,
        lineHeight: 15,
    },

    // Main columns and cards
    mainGrid: {
        gap: 18,
    },
    mainGridDesktop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    mainPrimary: {
        gap: 18,
    },
    mainPrimaryDesktop: {
        flex: 1.45,
        minWidth: 0,
    },
    mainSecondary: {
        gap: 18,
    },
    mainSecondaryDesktop: {
        flex: 1,
        minWidth: 0,
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 17,
        borderWidth: 1,
        borderColor: '#E7EBF1',
        padding: 18,
        shadowColor: '#25344B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.035,
        shadowRadius: 8,
        elevation: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 16,
    },
    sectionHeaderCopy: {
        flex: 1,
        minWidth: 0,
    },
    cardTitle: {
        color: '#202C3D',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: -0.15,
    },
    cardSubtitle: {
        color: '#8792A2',
        fontSize: 11,
        lineHeight: 16,
        marginTop: 4,
    },
    textAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    textActionLabel: {
        color: '#4659D8',
        fontSize: 10,
        fontWeight: '800',
    },

    // Order filters and rows
    filterRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 7,
        marginBottom: 5,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: '#F4F6F9',
        borderWidth: 1,
        borderColor: '#F4F6F9',
    },
    filterChipActive: {
        backgroundColor: '#EEF0FF',
        borderColor: '#DDE2FF',
    },
    filterChipText: {
        color: '#6F7B8C',
        fontSize: 10,
        fontWeight: '700',
    },
    filterChipTextActive: {
        color: '#4659D8',
    },
    filterCount: {
        color: '#8D98A7',
        fontSize: 9,
        fontWeight: '800',
    },
    filterCountActive: {
        color: '#4659D8',
    },
    orderItem: {
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF1F5',
        gap: 10,
    },
    orderItemLast: {
        borderBottomWidth: 0,
        paddingBottom: 2,
    },
    orderMainLine: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 11,
    },
    orderCodeIcon: {
        width: 35,
        height: 35,
        borderRadius: 10,
        backgroundColor: '#EEF0FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    orderInfo: {
        flex: 1,
        minWidth: 0,
    },
    orderTitleLine: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 7,
        marginBottom: 5,
    },
    orderCode: {
        color: '#69768A',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.4,
    },
    orderTitle: {
        color: '#253247',
        fontSize: 12,
        lineHeight: 17,
        fontWeight: '800',
    },
    orderResidential: {
        color: '#8994A3',
        fontSize: 10,
        marginTop: 3,
    },
    orderAmountBlock: {
        alignItems: 'flex-end',
        paddingTop: 1,
    },
    orderAmount: {
        color: '#263348',
        fontSize: 12,
        fontWeight: '900',
    },
    orderAmountCaption: {
        color: '#A0A9B5',
        fontSize: 9,
        marginTop: 3,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusDot: {
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    statusBadgeText: {
        fontSize: 8,
        fontWeight: '900',
    },
    orderMetaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 13,
        paddingLeft: 46,
    },
    orderMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    orderMetaText: {
        color: '#7C8797',
        fontSize: 9,
    },
    evidenceRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 7,
        paddingLeft: 46,
    },
    evidenceTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#FFF6E8',
        paddingHorizontal: 7,
        paddingVertical: 5,
        borderRadius: 6,
    },
    evidenceTagDone: {
        backgroundColor: '#EAF7F0',
    },
    evidenceText: {
        color: '#9B6A2D',
        fontSize: 9,
        fontWeight: '700',
    },
    evidenceTextDone: {
        color: '#23815A',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 34,
        paddingHorizontal: 16,
    },
    emptyIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#E8F7EF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    emptyTitle: {
        color: '#344054',
        fontSize: 12,
        fontWeight: '800',
        textAlign: 'center',
    },
    emptySubtitle: {
        color: '#929CAB',
        fontSize: 10,
        textAlign: 'center',
        lineHeight: 15,
        marginTop: 4,
    },

    // Weekly chart
    chartSummaryRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 7,
        marginBottom: 14,
    },
    chartTotal: {
        color: '#253247',
        fontSize: 25,
        fontWeight: '900',
    },
    chartSummaryText: {
        color: '#929CAB',
        fontSize: 10,
        fontWeight: '600',
    },
    chartBars: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-around',
        height: 112,
        paddingTop: 3,
    },
    chartColumn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-end',
        height: '100%',
        gap: 5,
    },
    chartCount: {
        color: '#748197',
        fontSize: 9,
        fontWeight: '800',
        height: 12,
    },
    chartTrack: {
        width: 22,
        height: 78,
        borderRadius: 7,
        backgroundColor: '#F1F3F8',
        justifyContent: 'flex-end',
        overflow: 'hidden',
    },
    chartBar: {
        width: '100%',
        borderRadius: 7,
    },
    chartDay: {
        color: '#9AA4B2',
        fontSize: 9,
        fontWeight: '700',
    },
    chartDayToday: {
        color: '#4659D8',
        fontWeight: '900',
    },

    // Payroll
    payrollSummary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 13,
        borderRadius: 12,
        backgroundColor: '#F3F5FF',
        marginBottom: 13,
    },
    payrollSummaryLabel: {
        color: '#77839A',
        fontSize: 10,
        fontWeight: '700',
    },
    payrollSummaryValue: {
        color: '#303F94',
        fontSize: 21,
        fontWeight: '900',
        marginTop: 3,
    },
    payrollSummaryIcon: {
        width: 39,
        height: 39,
        borderRadius: 12,
        backgroundColor: '#E5E9FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    payrollItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF1F5',
    },
    employeeAvatar: {
        width: 34,
        height: 34,
        borderRadius: 12,
        backgroundColor: '#EEF0FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    employeeAvatarText: {
        color: '#4659D8',
        fontSize: 10,
        fontWeight: '900',
    },
    payrollEmployeeInfo: {
        flex: 1,
        minWidth: 0,
    },
    payrollEmployeeName: {
        color: '#344054',
        fontSize: 10,
        fontWeight: '800',
    },
    payrollEmployeeMeta: {
        color: '#8792A2',
        fontSize: 9,
        marginTop: 3,
    },
    payrollBankAccount: {
        color: '#A0A9B5',
        fontSize: 8,
        marginTop: 2,
    },
    payrollActionColumn: {
        alignItems: 'flex-end',
        gap: 6,
    },
    payrollAmount: {
        color: '#16835D',
        fontSize: 11,
        fontWeight: '900',
    },
    payButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#16835D',
        paddingHorizontal: 9,
        paddingVertical: 7,
        borderRadius: 7,
    },
    payButtonText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '800',
    },
    payrollFootnote: {
        color: '#A0A9B5',
        fontSize: 9,
        lineHeight: 14,
        marginTop: 12,
    },
    emptyStateCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        backgroundColor: '#F0F8F3',
        padding: 12,
        borderRadius: 10,
    },
    emptyCompactText: {
        flex: 1,
        color: '#4E8067',
        fontSize: 10,
        fontWeight: '700',
    },

    // Team status
    teamStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: '#F7F8FA',
        borderRadius: 11,
        paddingVertical: 12,
        marginBottom: 8,
    },
    teamStat: {
        flex: 1,
        alignItems: 'center',
        gap: 3,
    },
    teamStatDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginBottom: 2,
    },
    teamStatValue: {
        color: '#344054',
        fontSize: 17,
        fontWeight: '900',
    },
    teamStatLabel: {
        color: '#8994A3',
        fontSize: 9,
        fontWeight: '700',
    },
    teamStatDivider: {
        width: 1,
        height: 35,
        backgroundColor: '#E4E8EE',
    },
    teamMember: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF1F5',
    },
    teamMemberLast: {
        borderBottomWidth: 0,
    },
    teamMemberAvatar: {
        width: 31,
        height: 31,
        borderRadius: 11,
        backgroundColor: '#F0F2F6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    teamMemberAvatarText: {
        color: '#657287',
        fontSize: 9,
        fontWeight: '900',
    },
    teamMemberInfo: {
        flex: 1,
        minWidth: 0,
    },
    teamMemberName: {
        color: '#344054',
        fontSize: 10,
        fontWeight: '800',
    },
    teamMemberRole: {
        color: '#929CAB',
        fontSize: 9,
        marginTop: 2,
    },
    teamMemberStatusWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    teamMemberStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    teamMemberStatusText: {
        color: '#7B8797',
        fontSize: 8,
        fontWeight: '700',
    },
    teamEmptyText: {
        color: '#929CAB',
        fontSize: 10,
        paddingVertical: 16,
        textAlign: 'center',
    },

    // Quick links and footer
    bottomSection: {
        gap: 13,
    },
    quickLinksGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        rowGap: 10,
    },
    quickLinkCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 11,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E7EBF1',
        borderRadius: 14,
        padding: 14,
    },
    quickLinkIcon: {
        width: 39,
        height: 39,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickLinkCopy: {
        flex: 1,
        minWidth: 0,
    },
    quickLinkTitle: {
        color: '#344054',
        fontSize: 11,
        fontWeight: '800',
    },
    quickLinkSubtitle: {
        color: '#929CAB',
        fontSize: 9,
        lineHeight: 13,
        marginTop: 3,
    },
    footer: {
        alignItems: 'center',
        paddingTop: 6,
        gap: 4,
    },
    footerText: {
        color: '#8C97A6',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
    },
    footerSubtext: {
        color: '#A6AFBB',
        fontSize: 9,
        textAlign: 'center',
    },
});
